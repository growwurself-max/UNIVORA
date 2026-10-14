const ApiError = require('../utils/ApiError');
const { createUserClient } = require('../config/supabase');
const { RESOURCES } = require('../config/resources');

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

const getResource = (key) => {
  const resource = RESOURCES[key];
  if (!resource) {
    throw new ApiError(404, `Unknown resource: ${key}`);
  }
  return resource;
};

const sanitizeSearch = (value) =>
  String(value || '')
    .replace(/[^a-zA-Z0-9 .@_-]/g, '')
    .trim()
    .slice(0, 100);

const parseListParams = (query = {}) => ({
  page: Math.max(1, parseInt(query.page, 10) || 1),
  limit: Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20)),
});

// Normalizes/validates a request body against the resource's field spec.
// Throws a 422 ApiError listing every offending field.
const normalizeFields = (resource, payload, { partial }) => {
  const body = payload || {};
  const changes = {};
  const errors = [];
  const fail = (field, message) => errors.push({ field, message });

  for (const [key, field] of Object.entries(resource.fields)) {
    const provided = Object.prototype.hasOwnProperty.call(body, key);

    if (!provided) {
      if (!partial && field.default !== undefined) changes[key] = field.default;
      continue;
    }

    const raw = body[key];
    const isBlank = raw === null || (typeof raw === 'string' && raw.trim() === '');

    if (isBlank) {
      if (field.required) {
        // Never blank out a required column on a partial update.
        if (!partial) fail(key, `${key} is required`);
        continue;
      }
      changes[key] = null;
      continue;
    }

    switch (field.type) {
      case 'string':
      case 'email': {
        let value = String(raw).trim();
        if (field.uppercase) value = value.toUpperCase();
        if (field.max && value.length > field.max) {
          fail(key, `${key} must be at most ${field.max} characters`);
          break;
        }
        if (field.type === 'email' && !EMAIL_RE.test(value)) {
          fail(key, `${key} must be a valid email address`);
          break;
        }
        changes[key] = value;
        break;
      }
      case 'number': {
        const value = Number(raw);
        if (!Number.isFinite(value)) {
          fail(key, `${key} must be a number`);
          break;
        }
        if (field.integer && !Number.isInteger(value)) {
          fail(key, `${key} must be a whole number`);
          break;
        }
        if (field.min !== undefined && value < field.min) {
          fail(key, `${key} must be at least ${field.min}`);
          break;
        }
        if (field.max !== undefined && value > field.max) {
          fail(key, `${key} must be at most ${field.max}`);
          break;
        }
        changes[key] = value;
        break;
      }
      case 'boolean': {
        if (typeof raw === 'boolean') changes[key] = raw;
        else changes[key] = ['true', '1', 'yes'].includes(String(raw).trim().toLowerCase());
        break;
      }
      case 'date': {
        const parsed = new Date(raw);
        if (Number.isNaN(parsed.getTime())) {
          fail(key, `${key} must be a valid date`);
          break;
        }
        changes[key] = String(raw).trim();
        break;
      }
      case 'datetime': {
        const parsed = new Date(raw);
        if (Number.isNaN(parsed.getTime())) {
          fail(key, `${key} must be a valid date/time`);
          break;
        }
        changes[key] = parsed.toISOString();
        break;
      }
      case 'time': {
        const value = String(raw).trim();
        if (!TIME_RE.test(value)) {
          fail(key, `${key} must be a valid time (HH:MM)`);
          break;
        }
        changes[key] = value.length === 5 ? `${value}:00` : value;
        break;
      }
      case 'uuid': {
        if (!UUID_RE.test(String(raw).trim())) {
          fail(key, `${key} must be a valid id`);
          break;
        }
        changes[key] = String(raw).trim();
        break;
      }
      case 'enum': {
        const value = String(raw).trim().toLowerCase();
        if (!field.values.includes(value)) {
          fail(key, `${key} must be one of: ${field.values.join(', ')}`);
          break;
        }
        changes[key] = value;
        break;
      }
      default:
        changes[key] = raw;
    }
  }

  if (!partial) {
    for (const [key, field] of Object.entries(resource.fields)) {
      if (field.required && changes[key] === undefined && !errors.some((e) => e.field === key)) {
        fail(key, `${key} is required`);
      }
    }
  }

  if (errors.length) {
    throw new ApiError(422, 'Validation failed', errors);
  }

  return changes;
};

const list = async ({ accessToken, resourceKey, query }) => {
  const resource = getResource(resourceKey);
  const supabase = createUserClient(accessToken);
  const { page, limit } = parseListParams(query);

  let builder = supabase.from(resource.table).select(resource.select, { count: 'exact' });

  for (const filter of resource.filters || []) {
    const value = query[filter];
    if (value !== undefined && value !== '') {
      builder = builder.eq(filter, value);
    }
  }

  const term = sanitizeSearch(query.search);
  if (term && resource.searchable && resource.searchable.length) {
    const orFilter = resource.searchable.map((column) => `${column}.ilike.%${term}%`).join(',');
    builder = builder.or(orFilter);
  }

  const { data, error, count } = await builder
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (error) throw error;

  return {
    items: data || [],
    total: count || 0,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil((count || 0) / limit)),
  };
};

const detail = async ({ accessToken, resourceKey, id }) => {
  const resource = getResource(resourceKey);
  const supabase = createUserClient(accessToken);

  const { data, error } = await supabase
    .from(resource.table)
    .select(resource.select)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new ApiError(404, 'Record not found');

  return data;
};

const create = async ({ accessToken, resourceKey, payload }) => {
  const resource = getResource(resourceKey);
  const supabase = createUserClient(accessToken);
  const row = normalizeFields(resource, payload, { partial: false });

  const { data, error } = await supabase
    .from(resource.table)
    .insert(row)
    .select(resource.select)
    .single();

  if (error) throw error;
  return data;
};

const update = async ({ accessToken, resourceKey, id, payload }) => {
  const resource = getResource(resourceKey);
  const supabase = createUserClient(accessToken);

  const { data: before, error: beforeError } = await supabase
    .from(resource.table)
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (beforeError) throw beforeError;
  if (!before) throw new ApiError(404, 'Record not found');

  const changes = normalizeFields(resource, payload, { partial: true });

  if (Object.keys(changes).length === 0) {
    return { before, after: before, changes };
  }

  const { data: after, error } = await supabase
    .from(resource.table)
    .update(changes)
    .eq('id', id)
    .select(resource.select)
    .single();

  if (error) throw error;
  return { before, after, changes };
};

const remove = async ({ accessToken, resourceKey, id }) => {
  const resource = getResource(resourceKey);
  const supabase = createUserClient(accessToken);

  const { data: before, error: beforeError } = await supabase
    .from(resource.table)
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (beforeError) throw beforeError;
  if (!before) throw new ApiError(404, 'Record not found');

  const { error } = await supabase.from(resource.table).delete().eq('id', id);
  if (error) throw error;

  return before;
};

const STAT_TABLES = [
  'students',
  'faculty',
  'departments',
  'courses',
  'subjects',
  'classes',
  'enrollments',
];

const getStats = async ({ accessToken }) => {
  const supabase = createUserClient(accessToken);

  const entries = await Promise.all(
    STAT_TABLES.map(async (table) => {
      const { count, error } = await supabase
        .from(table)
        .select('id', { count: 'exact', head: true });
      return [table, error ? 0 : count || 0];
    })
  );

  return Object.fromEntries(entries);
};

module.exports = {
  getResource,
  normalizeFields,
  sanitizeSearch,
  parseListParams,
  list,
  detail,
  create,
  update,
  remove,
  getStats,
};
