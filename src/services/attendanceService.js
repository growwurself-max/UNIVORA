const ApiError = require('../utils/ApiError');
const { createUserClient } = require('../config/supabase');
const {
  normalizeFields,
  sanitizeSearch,
  parseListParams,
} = require('./resourceService');
const {
  SESSIONS,
  SETTINGS,
  ATTENDANCE_STATUSES,
  DEFAULT_THRESHOLD,
} = require('../config/attendance');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SESSION_FILTERS = ['class_id', 'faculty_id', 'status'];

// Reads the caller institution's configured low-attendance threshold, falling
// back to the platform default when no settings row exists yet.
const getThreshold = async (supabase) => {
  const { data, error } = await supabase
    .from(SETTINGS.table)
    .select('low_attendance_threshold')
    .limit(1)
    .maybeSingle();

  if (error || !data) return DEFAULT_THRESHOLD;
  const value = Number(data.low_attendance_threshold);
  return Number.isFinite(value) ? value : DEFAULT_THRESHOLD;
};

// Attendance percentage counts "present" and "late" as attended.
const summarize = (records, threshold) => {
  const counts = { present: 0, absent: 0, late: 0, excused: 0 };
  records.forEach((record) => {
    if (counts[record.status] !== undefined) counts[record.status] += 1;
  });

  const total = records.length;
  const attended = counts.present + counts.late;
  const percentage = total ? Math.round((attended / total) * 1000) / 10 : 0;

  return {
    total,
    ...counts,
    attended,
    percentage,
    below_threshold: total > 0 && percentage < threshold,
  };
};

const inDateRange = (query, date) => {
  if (!date) return false;
  if (query.from && date < query.from) return false;
  if (query.to && date > query.to) return false;
  return true;
};

const listSessions = async ({ accessToken, query }) => {
  const supabase = createUserClient(accessToken);
  const { page, limit } = parseListParams(query);

  let builder = supabase.from(SESSIONS.table).select(SESSIONS.select, { count: 'exact' });

  SESSION_FILTERS.forEach((filter) => {
    const value = query[filter];
    if (value !== undefined && value !== '') builder = builder.eq(filter, value);
  });

  if (query.from) builder = builder.gte('session_date', query.from);
  if (query.to) builder = builder.lte('session_date', query.to);

  const term = sanitizeSearch(query.search);
  if (term) builder = builder.or(`notes.ilike.%${term}%`);

  const { data, error, count } = await builder
    .order('session_date', { ascending: false })
    .order('start_time', { ascending: false })
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

const sessionDetail = async ({ accessToken, id }) => {
  const supabase = createUserClient(accessToken);

  const { data: session, error } = await supabase
    .from(SESSIONS.table)
    .select(SESSIONS.select)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!session) throw new ApiError(404, 'Attendance session not found');

  const { data: records, error: recordsError } = await supabase
    .from('attendance_records')
    .select(
      'id, session_id, student_id, status, remarks, ' +
        'student:students!student_id ( id, admission_number, first_name, last_name )'
    )
    .eq('session_id', id)
    .order('created_at', { ascending: true });

  if (recordsError) throw recordsError;

  return { ...session, records: records || [] };
};

const createSession = async ({ accessToken, payload, actorId }) => {
  const supabase = createUserClient(accessToken);
  const row = normalizeFields(SESSIONS, payload, { partial: false });

  if (actorId) row.marked_by = actorId;

  const { data, error } = await supabase
    .from(SESSIONS.table)
    .insert(row)
    .select(SESSIONS.select)
    .single();

  if (error) throw error;
  return data;
};

const removeSession = async ({ accessToken, id }) => {
  const supabase = createUserClient(accessToken);

  const { data: before, error: beforeError } = await supabase
    .from(SESSIONS.table)
    .select(SESSIONS.select)
    .eq('id', id)
    .maybeSingle();

  if (beforeError) throw beforeError;
  if (!before) throw new ApiError(404, 'Attendance session not found');

  const { error } = await supabase.from(SESSIONS.table).delete().eq('id', id);
  if (error) throw error;

  return before;
};

const markAttendance = async ({ accessToken, sessionId, records }) => {
  if (!Array.isArray(records) || records.length === 0) {
    throw new ApiError(422, 'Validation failed', [
      { message: 'records must be a non-empty array' },
    ]);
  }

  const supabase = createUserClient(accessToken);

  const { data: session, error: sessionError } = await supabase
    .from(SESSIONS.table)
    .select('id')
    .eq('id', sessionId)
    .maybeSingle();

  if (sessionError) throw sessionError;
  if (!session) throw new ApiError(404, 'Attendance session not found');

  const errors = [];
  const rows = [];

  records.forEach((record, index) => {
    if (!UUID_RE.test(String(record.student_id || ''))) {
      errors.push({ message: `records[${index}].student_id must be a valid student id` });
      return;
    }
    if (!ATTENDANCE_STATUSES.includes(record.status)) {
      errors.push({
        message: `records[${index}].status must be one of ${ATTENDANCE_STATUSES.join(', ')}`,
      });
      return;
    }
    rows.push({
      session_id: sessionId,
      student_id: record.student_id,
      status: record.status,
      remarks: record.remarks ? String(record.remarks).slice(0, 500) : null,
    });
  });

  if (errors.length) throw new ApiError(422, 'Validation failed', errors);

  const { data, error } = await supabase
    .from('attendance_records')
    .upsert(rows, { onConflict: 'session_id,student_id' })
    .select('id, session_id, student_id, status, remarks');

  if (error) throw error;
  return data || [];
};

const studentSummary = async ({ accessToken, studentId, query = {} }) => {
  const supabase = createUserClient(accessToken);
  const threshold = await getThreshold(supabase);

  const { data, error } = await supabase
    .from('attendance_records')
    .select('status, session:attendance_sessions!session_id ( id, class_id, session_date )')
    .eq('student_id', studentId);

  if (error) throw error;

  const records = (data || [])
    .filter((record) => record.session)
    .filter((record) => inDateRange(query, record.session.session_date))
    .filter((record) => !query.class_id || record.session.class_id === query.class_id);

  return {
    student_id: studentId,
    threshold,
    ...summarize(records, threshold),
  };
};

// Groups every attendance record for the given sessions by student.
const groupByStudent = async (supabase, sessionMap, query) => {
  const { data, error } = await supabase
    .from('attendance_records')
    .select(
      'status, student_id, session_id, ' +
        'student:students!student_id ( id, admission_number, first_name, last_name )'
    )
    .in('session_id', Array.from(sessionMap.keys()));

  if (error) throw error;

  const byStudent = new Map();

  (data || []).forEach((record) => {
    const session = sessionMap.get(record.session_id);
    if (!session || !inDateRange(query, session.session_date)) return;
    if (!byStudent.has(record.student_id)) {
      byStudent.set(record.student_id, { student: record.student, records: [] });
    }
    byStudent.get(record.student_id).records.push(record);
  });

  return byStudent;
};

const classSummary = async ({ accessToken, classId, query = {} }) => {
  const supabase = createUserClient(accessToken);
  const threshold = await getThreshold(supabase);

  const { data: sessions, error } = await supabase
    .from(SESSIONS.table)
    .select('id, session_date')
    .eq('class_id', classId);

  if (error) throw error;

  const sessionMap = new Map((sessions || []).map((s) => [s.id, s]));
  if (sessionMap.size === 0) return { class_id: classId, threshold, students: [] };

  const byStudent = await groupByStudent(supabase, sessionMap, query);

  const students = Array.from(byStudent.entries())
    .map(([studentId, value]) => ({
      student_id: studentId,
      student: value.student,
      ...summarize(value.records, threshold),
    }))
    .sort((a, b) => a.percentage - b.percentage);

  return { class_id: classId, threshold, students };
};

const alerts = async ({ accessToken, query = {} }) => {
  const supabase = createUserClient(accessToken);
  const threshold = await getThreshold(supabase);

  let sessionQuery = supabase.from(SESSIONS.table).select('id, session_date, class_id');
  if (query.class_id) sessionQuery = sessionQuery.eq('class_id', query.class_id);

  const { data: sessions, error } = await sessionQuery;
  if (error) throw error;

  const sessionMap = new Map((sessions || []).map((s) => [s.id, s]));
  if (sessionMap.size === 0) return { threshold, students: [] };

  const byStudent = await groupByStudent(supabase, sessionMap, query);

  const students = Array.from(byStudent.entries())
    .map(([studentId, value]) => ({
      student_id: studentId,
      student: value.student,
      ...summarize(value.records, threshold),
    }))
    .filter((student) => student.below_threshold)
    .sort((a, b) => a.percentage - b.percentage);

  return { threshold, students };
};

const getSettings = async ({ accessToken }) => {
  const supabase = createUserClient(accessToken);

  const { data, error } = await supabase
    .from(SETTINGS.table)
    .select(SETTINGS.select)
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return data || { low_attendance_threshold: DEFAULT_THRESHOLD, alerts_enabled: true };
};

const updateSettings = async ({ accessToken, payload }) => {
  const supabase = createUserClient(accessToken);
  const changes = normalizeFields(SETTINGS, payload, { partial: true });

  const { data: existing, error } = await supabase
    .from(SETTINGS.table)
    .select('id')
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  if (!existing) {
    const row = normalizeFields(SETTINGS, payload, { partial: false });
    const { data, error: insertError } = await supabase
      .from(SETTINGS.table)
      .insert(row)
      .select(SETTINGS.select)
      .single();

    if (insertError) throw insertError;
    return data;
  }

  if (Object.keys(changes).length === 0) {
    return getSettings({ accessToken });
  }

  const { data, error: updateError } = await supabase
    .from(SETTINGS.table)
    .update(changes)
    .eq('id', existing.id)
    .select(SETTINGS.select)
    .single();

  if (updateError) throw updateError;
  return data;
};

module.exports = {
  listSessions,
  sessionDetail,
  createSession,
  removeSession,
  markAttendance,
  studentSummary,
  classSummary,
  alerts,
  getSettings,
  updateSettings,
};
