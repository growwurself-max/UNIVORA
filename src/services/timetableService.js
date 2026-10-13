const ApiError = require('../utils/ApiError');
const { createUserClient } = require('../config/supabase');
const {
  normalizeFields,
  sanitizeSearch,
  parseListParams,
} = require('./resourceService');
const { TIMETABLE } = require('../config/attendance');

// Finds an existing active slot that overlaps the candidate and shares a class,
// faculty member or room on the same day. RLS scopes the query to the caller's
// institution, so this never leaks other institutions' schedules.
const findConflict = async (supabase, row, excludeId) => {
  const { data, error } = await supabase
    .from(TIMETABLE.table)
    .select('id, class_id, faculty_id, room, start_time, end_time')
    .eq('status', 'active')
    .eq('day_of_week', row.day_of_week)
    .lt('start_time', row.end_time)
    .gt('end_time', row.start_time);

  if (error) throw error;

  const room = row.room ? row.room.trim().toLowerCase() : null;

  return (
    (data || []).find((entry) => {
      if (excludeId && entry.id === excludeId) return false;
      if (row.class_id && entry.class_id === row.class_id) return true;
      if (row.faculty_id && entry.faculty_id === row.faculty_id) return true;
      if (room && entry.room && entry.room.trim().toLowerCase() === room) return true;
      return false;
    }) || null
  );
};

const assertNoConflict = async (supabase, row, excludeId) => {
  if (row.status && row.status !== 'active') return;

  const conflict = await findConflict(supabase, row, excludeId);
  if (!conflict) return;

  const reason =
    row.class_id && conflict.class_id === row.class_id
      ? 'class'
      : row.faculty_id && conflict.faculty_id === row.faculty_id
        ? 'faculty member'
        : 'room';

  throw new ApiError(409, 'Scheduling conflict', [
    { message: `The ${reason} is already booked for this time slot.` },
  ]);
};

const list = async ({ accessToken, query }) => {
  const supabase = createUserClient(accessToken);
  const { page, limit } = parseListParams(query);

  let builder = supabase.from(TIMETABLE.table).select(TIMETABLE.select, { count: 'exact' });

  for (const filter of TIMETABLE.filters) {
    const value = query[filter];
    if (value !== undefined && value !== '') builder = builder.eq(filter, value);
  }

  const term = sanitizeSearch(query.search);
  if (term) {
    const orFilter = TIMETABLE.searchable.map((column) => `${column}.ilike.%${term}%`).join(',');
    builder = builder.or(orFilter);
  }

  const { data, error, count } = await builder
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true })
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

const detail = async ({ accessToken, id }) => {
  const supabase = createUserClient(accessToken);
  const { data, error } = await supabase
    .from(TIMETABLE.table)
    .select(TIMETABLE.select)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new ApiError(404, 'Timetable entry not found');

  return data;
};

const create = async ({ accessToken, payload }) => {
  const supabase = createUserClient(accessToken);
  const row = normalizeFields(TIMETABLE, payload, { partial: false });

  await assertNoConflict(supabase, row, null);

  const { data, error } = await supabase
    .from(TIMETABLE.table)
    .insert(row)
    .select(TIMETABLE.select)
    .single();

  if (error) throw error;
  return data;
};

const update = async ({ accessToken, id, payload }) => {
  const supabase = createUserClient(accessToken);

  const { data: before, error: beforeError } = await supabase
    .from(TIMETABLE.table)
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (beforeError) throw beforeError;
  if (!before) throw new ApiError(404, 'Timetable entry not found');

  const changes = normalizeFields(TIMETABLE, payload, { partial: true });

  if (Object.keys(changes).length === 0) {
    return { before, after: before, changes };
  }

  await assertNoConflict(supabase, { ...before, ...changes }, id);

  const { data: after, error } = await supabase
    .from(TIMETABLE.table)
    .update(changes)
    .eq('id', id)
    .select(TIMETABLE.select)
    .single();

  if (error) throw error;
  return { before, after, changes };
};

const remove = async ({ accessToken, id }) => {
  const supabase = createUserClient(accessToken);

  const { data: before, error: beforeError } = await supabase
    .from(TIMETABLE.table)
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (beforeError) throw beforeError;
  if (!before) throw new ApiError(404, 'Timetable entry not found');

  const { error } = await supabase.from(TIMETABLE.table).delete().eq('id', id);
  if (error) throw error;

  return before;
};

module.exports = {
  list,
  detail,
  create,
  update,
  remove,
};
