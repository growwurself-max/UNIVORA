// Declarative field/select definitions for the Phase 4 exams, grades & results
// resources. Consumed by the shared `normalizeFields` validator (via a minimal
// `{ fields }` resource shape) and by the dedicated exam/result services.

const EXAM_TYPES = {
  table: 'exam_types',
  select: 'id, institution_id, name, code, weight, status, description, created_at, updated_at',
  searchable: ['name', 'code'],
  filters: ['status'],
  fields: {
    name: { type: 'string', required: true, max: 100 },
    code: { type: 'string', max: 30, uppercase: true },
    weight: { type: 'number', min: 0, max: 100 },
    status: { type: 'enum', values: ['active', 'inactive'], default: 'active' },
    description: { type: 'string', max: 1000 },
  },
};

const GRADING_SCALES = {
  table: 'grading_scales',
  select: 'id, institution_id, name, is_default, status, description, created_at, updated_at',
  searchable: ['name'],
  filters: ['status', 'is_default'],
  fields: {
    name: { type: 'string', required: true, max: 100 },
    is_default: { type: 'boolean', default: false },
    status: { type: 'enum', values: ['active', 'inactive'], default: 'active' },
    description: { type: 'string', max: 1000 },
  },
};

const GRADING_BANDS = {
  table: 'grading_scale_bands',
  select:
    'id, institution_id, grading_scale_id, grade_label, min_percentage, max_percentage, grade_point, is_pass, created_at, updated_at',
  filters: ['grading_scale_id'],
  fields: {
    grade_label: { type: 'string', required: true, max: 20 },
    min_percentage: { type: 'number', required: true, min: 0, max: 100 },
    max_percentage: { type: 'number', required: true, min: 0, max: 100 },
    grade_point: { type: 'number', min: 0, max: 100 },
    is_pass: { type: 'boolean', default: true },
  },
};

const EXAMS = {
  table: 'exams',
  select:
    'id, institution_id, exam_type_id, academic_year_id, term_id, class_id, subject_id, name, exam_date, start_time, end_time, max_marks, pass_marks, status, notes, created_at, updated_at, ' +
    'exam_type:exam_types!exam_type_id ( id, name, code ), ' +
    'academic_year:academic_years!academic_year_id ( id, name ), ' +
    'term:terms!term_id ( id, name ), ' +
    'class:classes!class_id ( id, name, section ), ' +
    'subject:subjects!subject_id ( id, name, code )',
  searchable: ['name', 'notes'],
  filters: ['exam_type_id', 'academic_year_id', 'term_id', 'class_id', 'subject_id', 'status'],
  fields: {
    exam_type_id: { type: 'uuid', required: true },
    academic_year_id: { type: 'uuid', required: true },
    term_id: { type: 'uuid' },
    class_id: { type: 'uuid', required: true },
    subject_id: { type: 'uuid' },
    name: { type: 'string', required: true, max: 150 },
    exam_date: { type: 'date' },
    start_time: { type: 'time' },
    end_time: { type: 'time' },
    max_marks: { type: 'number', required: true, min: 0.01, max: 100000, default: 100 },
    pass_marks: { type: 'number', min: 0, max: 100000 },
    status: {
      type: 'enum',
      values: ['scheduled', 'ongoing', 'completed', 'cancelled'],
      default: 'scheduled',
    },
    notes: { type: 'string', max: 1000 },
  },
};

// Built-in grading scheme used when an institution has not configured its own.
const DEFAULT_GRADING_BANDS = [
  { grade_label: 'A+', min_percentage: 90, max_percentage: 100, grade_point: 4, is_pass: true },
  { grade_label: 'A', min_percentage: 80, max_percentage: 90, grade_point: 3.7, is_pass: true },
  { grade_label: 'B', min_percentage: 70, max_percentage: 80, grade_point: 3, is_pass: true },
  { grade_label: 'C', min_percentage: 60, max_percentage: 70, grade_point: 2, is_pass: true },
  { grade_label: 'D', min_percentage: 50, max_percentage: 60, grade_point: 1, is_pass: true },
  { grade_label: 'F', min_percentage: 0, max_percentage: 50, grade_point: 0, is_pass: false },
];

const DEFAULT_PASS_PERCENTAGE = 50;

module.exports = {
  EXAM_TYPES,
  GRADING_SCALES,
  GRADING_BANDS,
  EXAMS,
  DEFAULT_GRADING_BANDS,
  DEFAULT_PASS_PERCENTAGE,
};
