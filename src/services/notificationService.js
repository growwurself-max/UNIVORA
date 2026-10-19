const { createUserClient } = require('../config/supabase');
const ApiError = require('../utils/ApiError');
const { normalizeFields } = require('./resourceService');
const { NOTIFICATIONS } = require('../config/notifications');

const listNotifications = async ({ accessToken, query = {} }) => {
  const supabase = createUserClient(accessToken);
  const { page, limit } = require('./resourceService').parseListParams(query);

  let builder = supabase.from(NOTIFICATIONS.table).select(NOTIFICATIONS.select, { count: 'exact' });

  if (query.type) builder = builder.eq('type', query.type);
  if (query.is_read !== undefined && query.is_read !== '') builder = builder.eq('is_read', query.is_read === 'true');

  const term = require('./resourceService').sanitizeSearch(query.search);
  if (term && NOTIFICATIONS.searchable?.length) {
    const orFilter = NOTIFICATIONS.searchable.map((c) => `${c}.ilike.%${term}%`).join(',');
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

const markAsRead = async ({ accessToken, id }) => {
  const supabase = createUserClient(accessToken);
  const { data, error } = await supabase
    .from(NOTIFICATIONS.table)
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', id)
    .select(NOTIFICATIONS.select)
    .single();
  if (error) throw error;
  return data;
};

const createNotification = async ({ accessToken, payload }) => {
  const supabase = createUserClient(accessToken);
  const row = normalizeFields(NOTIFICATIONS, payload, { partial: false });
  if (row.data && typeof row.data === 'string') {
    try { row.data = JSON.parse(row.data); } catch (e) { row.data = {}; }
  }
  const { data, error } = await supabase
    .from(NOTIFICATIONS.table)
    .insert(row)
    .select(NOTIFICATIONS.select)
    .single();
  if (error) throw error;
  return data;
};

const deleteNotification = async ({ accessToken, id }) => {
  const supabase = createUserClient(accessToken);
  const { error } = await supabase.from(NOTIFICATIONS.table).delete().eq('id', id);
  if (error) throw error;
  return { id };
};

module.exports = { listNotifications, markAsRead, createNotification, deleteNotification };
