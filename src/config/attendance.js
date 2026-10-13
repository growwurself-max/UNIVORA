// Declarative field/select definitions for the Phase 3 attendance & timetable
// resources. These are consumed by the shared `normalizeFields` validator (via
// a minimal `{ fields }` resource shape) and by the dedicated services.

const TIMETABLE = {
  table: 'timetable_entries',
  select:
    'id, institution_id, class_id, subject_id, faculty_id, term_id, room, day_of_week, start_time, end_time, status, notes, created_at, updated_at, ' +
    'class:classes!class_id ( id, name, section ), ' +
    'subject:subjects!subject_id ( id, name, code ), ' +
    'faculty:faculty!faculty_id ( id, first_name, last_name ), ' +
    'term:terms!term_id ( id, name )',
  searchable: ['room', 'notes'],
  filters: ['class_id', 'faculty_id', 'term_id', 'subject_id', 'day_of_week', 'status'],
  fields: {
    class_id: { type: 'uuid', required: true },
    subject_id: { type: 'uuid' },
    faculty_id: { type: 'uuid' },
    term_id: { type: 'uuid' },
    room: { type: 'string', max: 50 },
    day_of_week: { type: 'number', required: true, integer: true, min: 1, max: 7 },
    start_time: { type: 'time', required: true },
    end_time: { type: 'time', required: true },
    status: { type: 'enum', values: ['active', 'inactive'], default: 'active' },
    notes: { type: 'string', max: 500 },
  },
};

const SESSIONS = {
  table: 'attendance_sessions',
  select:
    'id, institution_id, class_id, timetable_entry_id, subject_id, faculty_id, session_date, start_time, end_time, status, notes, marked_by, created_at, updated_at, ' +
    'class:classes!class_id ( id, name, section ), ' +
    'subject:subjects!subject_id ( id, name, code ), ' +
    'faculty:faculty!faculty_id ( id, first_name, last_name )',
  searchable: ['notes'],
  filters: ['class_id', 'faculty_id', 'status'],
  fields: {
    class_id: { type: 'uuid', required: true },
    timetable_entry_id: { type: 'uuid' },
    subject_id: { type: 'uuid' },
    faculty_id: { type: 'uuid' },
    session_date: { type: 'date', required: true },
    start_time: { type: 'time' },
    end_time: { type: 'time' },
    status: { type: 'enum', values: ['open', 'closed'], default: 'open' },
    notes: { type: 'string', max: 500 },
  },
};

const SETTINGS = {
  table: 'attendance_settings',
  select: 'id, institution_id, low_attendance_threshold, alerts_enabled, created_at, updated_at',
  fields: {
    low_attendance_threshold: { type: 'number', min: 0, max: 100, default: 75 },
    alerts_enabled: { type: 'boolean', default: true },
  },
};

const ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'excused'];

const DEFAULT_THRESHOLD = 75;

module.exports = {
  TIMETABLE,
  SESSIONS,
  SETTINGS,
  ATTENDANCE_STATUSES,
  DEFAULT_THRESHOLD,
};
