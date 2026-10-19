const ApiError = require('../utils/ApiError');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { createClient } = require('@supabase/supabase-js');
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

const refreshSession = async (refreshToken) => {
  const authClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const { data, error } = await authClient.auth.refreshSession({ refresh_token: refreshToken });

  if (error || !data?.user || !data?.session) {
    throw new ApiError(401, 'Session expired. Please sign in again.');
  }

  return withProfile(buildAuthResponse(data));
};

const logout = async (accessToken) => {
  const { error } = await supabaseAdmin.auth.admin.signOut(accessToken, 'local');
  if (error) {
    throw new ApiError(502, 'Unable to revoke the current session. Please try again.');
  }
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
    const message = isMissingSchemaError(profileError)
      ? 'Role data is not configured. Apply the Supabase database migrations before signing in.'
      : 'Unable to load your account role. Please try again later.';
    throw new ApiError(503, message);
  }

  if (profileRow) {
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

const getAuthorizationProfile = async (userId) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('institution_id, roles(name)')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new ApiError(503, 'Unable to load your account permissions. Please try again later.');
  }

  if (!data) return null;

  return {
    institution_id: data.institution_id,
    role: data.roles?.name ?? null,
  };
};

// Augments a sign-in/sign-up response with the caller's profile so the frontend
// can render role-aware views immediately after login.
const withProfile = async (authResponse) => {
  const profile = await getProfile(authResponse.user.id);
  authResponse.user.profile = profile.profile;
  return authResponse;
};

const DEMO_NAME = 'Demo User';
const DEMO_INSTITUTION_SLUG = 'demo';

// Assigns the demo account to a dedicated demo institution with the admin role.
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
    .eq('name', 'College Admin')
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
  if (env.isProduction) {
    throw new ApiError(403, 'Demo user creation is not allowed in production');
  }
  if (!env.demoEmail || !env.demoPassword) {
    throw new ApiError(503, 'Demo access is not configured for this environment');
  }

  let userId;

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: env.demoEmail,
    password: env.demoPassword,
    email_confirm: true,
    // app_metadata is server-controlled: users cannot write to it themselves.
    app_metadata: { is_demo: true },
    user_metadata: { name: DEMO_NAME },
  });

  if (createError) {
    if (/already registered|already been registered/i.test(createError.message)) {
      const { data: list, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (listError) throw new ApiError(500, 'Unable to look up the configured demo account');
      userId = list?.users?.find((u) => u.email?.toLowerCase() === env.demoEmail.toLowerCase())?.id;
    } else {
      throw new ApiError(500, 'Unable to create the configured demo account');
    }
  }

  userId = userId || created?.user?.id;
  if (!userId) throw new ApiError(500, 'Unable to resolve the configured demo account');

  await provisionDemoAccess(userId);
  return login({ email: env.demoEmail, password: env.demoPassword });
};

module.exports = {
  register,
  login,
  refreshSession,
  logout,
  getProfile,
  getAuthorizationProfile,
  verifyToken,
  createDemoUser,
};
