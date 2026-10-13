const ApiError = require('../utils/ApiError');
const { supabase, supabaseAdmin } = require('../config/supabase');
const env = require('../config/env');

const buildAuthResponse = (data) => ({
  user: {
    id: data.user.id,
    email: data.user.email,
    emailConfirmed: data.user.email_confirmed_at !== null,
    createdAt: data.user.created_at,
    metadata: data.user.user_metadata,
  },
  session: {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresIn: data.session.expires_in,
  },
});

const register = async ({ email, password, name }) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
      },
      emailConfirm: !env.isProduction, // Skip email confirmation in development
    },
  });

  if (error) {
    if (error.message.includes('already registered')) {
      throw new ApiError(409, 'Email already registered');
    }
    throw new ApiError(400, error.message);
  }

  if (!data.session) {
    throw new ApiError(400, 'Registration successful. Please check your email to confirm your account.');
  }

  return withProfile(buildAuthResponse(data));
};

const login = async ({ email, password }) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (error.message.includes('Invalid login credentials')) {
      throw new ApiError(401, 'Invalid email or password');
    }
    throw new ApiError(400, error.message);
  }

  return withProfile(buildAuthResponse(data));
};

const PROFILE_SELECT =
  'institution_id, full_name, is_demo, roles ( name ), institutions ( id, name, slug )';

// A missing relation means the Phase 0 migrations have not been applied yet.
const isMissingSchemaError = (error) =>
  error?.code === 'PGRST205' ||
  error?.code === '42P01' ||
  /could not find the table|does not exist/i.test(error?.message || '');

const getProfile = async (userId) => {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);

  if (error || !data?.user) {
    throw new ApiError(404, 'User not found');
  }

  const user = data.user;

  let profile = null;
  const { data: profileRow, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', userId)
    .maybeSingle();

  if (profileError) {
    // Tolerate a pre-migration database so auth keeps working.
    if (!isMissingSchemaError(profileError)) {
      console.error('Failed to load profile:', profileError.message);
    }
  } else if (profileRow) {
    profile = {
      fullName: profileRow.full_name,
      isDemo: profileRow.is_demo,
      role: profileRow.roles?.name ?? null,
      institutionId: profileRow.institution_id,
      institution: profileRow.institutions
        ? {
            id: profileRow.institutions.id,
            name: profileRow.institutions.name,
            slug: profileRow.institutions.slug,
          }
        : null,
    };
  }

  return {
    id: user.id,
    email: user.email,
    emailConfirmed: user.email_confirmed_at !== null,
    createdAt: user.created_at,
    metadata: user.user_metadata,
    profile,
  };
};

const verifyToken = async (token) => {
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new ApiError(401, 'Invalid or expired token');
  }

  return user;
};

// Returns the caller's current role name (or null pre-migration / no profile).
// The role is read server-side from their own profile row, never from client input.
const getRole = async (userId) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('roles ( name )')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data.roles?.name ?? null;
};

// Augments a sign-in/sign-up response with the caller's profile so the frontend
// can render role-aware views immediately after login.
const withProfile = async (authResponse) => {
  try {
    const profile = await getProfile(authResponse.user.id);
    authResponse.user.profile = profile.profile;
  } catch (error) {
    if (!isMissingSchemaError(error)) {
      console.error('Failed to attach profile to auth response:', error.message);
    }
    authResponse.user.profile = null;
  }
  return authResponse;
};

const DEMO_EMAIL = 'demo@univora.dev';
const DEMO_PASSWORD = 'demo123';
const DEMO_NAME = 'Demo User';
const DEMO_INSTITUTION_SLUG = 'demo';

// Assigns the demo account to a dedicated demo institution with the owner role.
// Runs with the service-role key so it bypasses RLS, but it is the ONLY place
// privileged fields are set. Client-supplied roles/institution IDs are never trusted.
const provisionDemoAccess = async (userId) => {
  const { data: existingInstitution, error: institutionSelectError } = await supabaseAdmin
    .from('institutions')
    .select('id')
    .eq('slug', DEMO_INSTITUTION_SLUG)
    .maybeSingle();

  if (institutionSelectError) {
    throw institutionSelectError;
  }

  let institutionId = existingInstitution?.id;

  if (!institutionId) {
    const { data: inserted, error: institutionInsertError } = await supabaseAdmin
      .from('institutions')
      .insert({ name: 'Univora Demo Institution', slug: DEMO_INSTITUTION_SLUG })
      .select('id')
      .single();

    if (institutionInsertError) {
      throw institutionInsertError;
    }

    institutionId = inserted.id;
  }

  const { data: ownerRole, error: roleError } = await supabaseAdmin
    .from('roles')
    .select('id')
    .eq('name', 'owner')
    .single();

  if (roleError) {
    throw roleError;
  }

  const { error: profileError } = await supabaseAdmin.from('profiles').upsert(
    {
      id: userId,
      institution_id: institutionId,
      role_id: ownerRole.id,
      full_name: DEMO_NAME,
      email: DEMO_EMAIL,
      is_demo: true,
    },
    { onConflict: 'id' }
  );

  if (profileError) {
    throw profileError;
  }
};

const createDemoUser = async () => {
  // Only allow in development
  if (env.isProduction) {
    throw new ApiError(403, 'Demo user creation is not allowed in production');
  }

  let userId;

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
    // app_metadata is server-controlled: users cannot write to it themselves.
    app_metadata: { is_demo: true },
    user_metadata: { name: DEMO_NAME },
  });

  if (createError) {
    if (/already registered|already been registered/i.test(createError.message)) {
      const { data: list, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (!listError) {
        userId = list?.users?.find((u) => u.email?.toLowerCase() === DEMO_EMAIL)?.id;
      }
    } else {
      throw new ApiError(500, `Failed to create demo user: ${createError.message}`);
    }
  } else {
    userId = created?.user?.id;
  }

  // Best-effort role/institution provisioning. If the Phase 0 migrations are not
  // applied yet, the demo user can still sign in (auth works without profiles).
  if (userId) {
    try {
      await provisionDemoAccess(userId);
    } catch (error) {
      if (!isMissingSchemaError(error)) {
        console.error('Demo access provisioning failed:', error.message);
      }
    }
  }

  return {
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    name: DEMO_NAME,
    message: 'Demo user ready',
  };
};

module.exports = {
  register,
  login,
  getProfile,
  getRole,
  verifyToken,
  createDemoUser,
};
