const ApiError = require('../utils/ApiError');
const { createUserClient } = require('../config/supabase');

const SUBSCRIPTION_PLANS = ['free', 'basic', 'pro', 'enterprise'];
const STATUSES = ['active', 'suspended'];
const EDITABLE_FIELDS = [
  'name',
  'slug',
  'domain',
  'status',
  'subscription_plan',
  'subscription_expires_at',
];

const slugify = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);

// Keeps PostgREST `or()` filters safe: strips characters that could alter the
// filter grammar, then caps the length.
const sanitizeSearch = (value) =>
  String(value || '')
    .replace(/[^a-zA-Z0-9 .@_-]/g, '')
    .trim()
    .slice(0, 100);

const normalizePayload = (payload, { partial }) => {
  const changes = {};

  if (payload.name !== undefined) changes.name = String(payload.name).trim();
  if (payload.slug !== undefined) changes.slug = String(payload.slug).trim().toLowerCase();
  if (payload.domain !== undefined) {
    const domain = payload.domain === null ? '' : String(payload.domain).trim();
    changes.domain = domain || null;
  }
  if (payload.status !== undefined) changes.status = String(payload.status).toLowerCase();
  if (payload.subscription_plan !== undefined) {
    changes.subscription_plan = String(payload.subscription_plan).toLowerCase();
  }
  if (payload.subscription_expires_at !== undefined) {
    changes.subscription_expires_at = payload.subscription_expires_at || null;
  }

  if (!partial) {
    if (!changes.name) throw new ApiError(422, 'Institution name is required');
    if (!changes.slug) changes.slug = slugify(changes.name);
    if (!changes.status) changes.status = 'active';
    if (!changes.subscription_plan) changes.subscription_plan = 'free';
  } else {
    // On partial updates, ignore empty strings so callers cannot accidentally
    // blank out required columns (name/slug). Omitted fields stay untouched.
    if (changes.name === '') delete changes.name;
    if (changes.slug === '') delete changes.slug;
  }

  if (changes.status && !STATUSES.includes(changes.status)) {
    throw new ApiError(422, 'Invalid status');
  }
  if (changes.subscription_plan && !SUBSCRIPTION_PLANS.includes(changes.subscription_plan)) {
    throw new ApiError(422, 'Invalid subscription plan');
  }

  return changes;
};

const listInstitutions = async ({ accessToken, search, status, subscriptionPlan, page, limit }) => {
  const supabase = createUserClient(accessToken);
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  let query = supabase.from('institutions').select('*', { count: 'exact' });

  if (status) query = query.eq('status', status);
  if (subscriptionPlan) query = query.eq('subscription_plan', subscriptionPlan);

  const term = sanitizeSearch(search);
  if (term) {
    query = query.or(`name.ilike.%${term}%,slug.ilike.%${term}%,domain.ilike.%${term}%`);
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range((safePage - 1) * safeLimit, safePage * safeLimit - 1);

  if (error) throw error;

  return {
    items: data || [],
    total: count || 0,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.max(1, Math.ceil((count || 0) / safeLimit)),
  };
};

const getInstitutionStats = async ({ accessToken }) => {
  const supabase = createUserClient(accessToken);

  const { data, error } = await supabase
    .from('institutions')
    .select('status, subscription_plan, created_at');

  if (error) throw error;

  const rows = data || [];
  const byPlan = SUBSCRIPTION_PLANS.reduce((acc, plan) => {
    acc[plan] = rows.filter((row) => row.subscription_plan === plan).length;
    return acc;
  }, {});

  const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  return {
    total: rows.length,
    active: rows.filter((row) => row.status === 'active').length,
    suspended: rows.filter((row) => row.status === 'suspended').length,
    addedLast30Days: rows.filter((row) => new Date(row.created_at).getTime() >= monthAgo).length,
    byPlan,
  };
};

const countForInstitution = async (supabase, table, institutionId) => {
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('institution_id', institutionId);

  if (error) throw error;
  return count || 0;
};

const getInstitutionDetail = async ({ accessToken, id }) => {
  const supabase = createUserClient(accessToken);

  const { data: institution, error } = await supabase
    .from('institutions')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!institution) throw new ApiError(404, 'Institution not found');

  const [members, departments, academicYears, terms] = await Promise.all([
    countForInstitution(supabase, 'profiles', id),
    countForInstitution(supabase, 'departments', id),
    countForInstitution(supabase, 'academic_years', id),
    countForInstitution(supabase, 'terms', id),
  ]);

  return {
    institution,
    stats: { members, departments, academicYears, terms },
  };
};

const createInstitution = async ({ accessToken, payload }) => {
  const supabase = createUserClient(accessToken);
  const row = normalizePayload(payload, { partial: false });

  const { data, error } = await supabase.from('institutions').insert(row).select('*').single();

  if (error) throw error;
  return data;
};

const updateInstitution = async ({ accessToken, id, payload }) => {
  const supabase = createUserClient(accessToken);

  const { data: before, error: beforeError } = await supabase
    .from('institutions')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (beforeError) throw beforeError;
  if (!before) throw new ApiError(404, 'Institution not found');

  const changes = normalizePayload(payload, { partial: true });

  if (Object.keys(changes).length === 0) {
    return { before, after: before, changes };
  }

  const { data: after, error } = await supabase
    .from('institutions')
    .update(changes)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return { before, after, changes };
};

module.exports = {
  SUBSCRIPTION_PLANS,
  STATUSES,
  EDITABLE_FIELDS,
  listInstitutions,
  getInstitutionStats,
  getInstitutionDetail,
  createInstitution,
  updateInstitution,
};
