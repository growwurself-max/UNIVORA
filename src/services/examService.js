const ApiError = require('../utils/ApiError');
const { createUserClient } = require('../config/supabase');
const {
  normalizeFields,
  sanitizeSearch,
  parseListParams,
} = require('./resourceService');
const {
  EXAM_TYPES,
  GRADING_SCALES,
  GRADING_BANDS,
  EXAMS,
  DEFAULT_GRADING_BANDS,
  DEFAULT_PASS_PERCENTAGE,
} = require('../config/exams');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const round2 = (value) => Math.round(value * 100) / 100;

// ---------------------------------------------------------------------------
// Generic RLS-scoped helpers (mirror the academic resource service so exam
// config behaves the same way as the rest of the platform).
// ---------------------------------------------------------------------------
const listResource = async (supabase, resource, query = {}) => {
  const { page, limit } = parseListParams(query);
  let builder = supabase.from(resource.table).select(resource.select, { count: 'exact' });

  for (const filter of resource.filters || []) {
    const value = query[filter];
    if (value !== undefined && value !== '') builder = builder.eq(filter, value);
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

const resourceDetail = async (supabase, resource, id, notFound) => {
  const { data, error } = await supabase
    .from(resource.table)
    .select(resource.select)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new ApiError(404, notFound);
  return data;
};

const removeResource = async (supabase, resource, id, notFound) => {
  const before = await resourceDetail(supabase, resource, id, notFound);
  const { error } = await supabase.from(resource.table).delete().eq('id', id);
  if (error) throw error;
  return before;
};

// ---------------------------------------------------------------------------
// Exam types
// ---------------------------------------------------------------------------
const listExamTypes = async ({ accessToken, query }) => {
  const supabase = createUserClient(accessToken);
  return listResource(supabase, EXAM_TYPES, query);
};

const createExamType = async ({ accessToken, payload }) => {
  const supabase = createUserClient(accessToken);
  const row = normalizeFields(EXAM_TYPES, payload, { partial: false });

  const { data, error } = await supabase
    .from(EXAM_TYPES.table)
    .insert(row)
    .select(EXAM_TYPES.select)
    .single();

  if (error) throw error;
  return data;
};

const updateExamType = async ({ accessToken, id, payload }) => {
  const supabase = createUserClient(accessToken);
  const before = await resourceDetail(supabase, EXAM_TYPES, id, 'Exam type not found');
  const changes = normalizeFields(EXAM_TYPES, payload, { partial: true });

  if (Object.keys(changes).length === 0) {
    return { before, after: before, changes };
  }

  const { data: after, error } = await supabase
    .from(EXAM_TYPES.table)
    .update(changes)
    .eq('id', id)
    .select(EXAM_TYPES.select)
    .single();

  if (error) throw error;
  return { before, after, changes };
};

const removeExamType = async ({ accessToken, id }) => {
  const supabase = createUserClient(accessToken);
  return removeResource(supabase, EXAM_TYPES, id, 'Exam type not found');
};

// ---------------------------------------------------------------------------
// Grading scales (+ bands)
// ---------------------------------------------------------------------------
const normalizeBands = (bands) => {
  if (bands === undefined) return null;
  if (!Array.isArray(bands)) {
    throw new ApiError(422, 'Validation failed', [
      { field: 'bands', message: 'bands must be an array' },
    ]);
  }

  const errors = [];
  const rows = [];

  bands.forEach((band, index) => {
    let row;
    try {
      row = normalizeFields(GRADING_BANDS, band, { partial: false });
    } catch (error) {
      (error.errors || []).forEach((item) =>
        errors.push({ field: `bands[${index}].${item.field}`, message: item.message })
      );
      return;
    }

    if (row.min_percentage >= row.max_percentage) {
      errors.push({
        field: `bands[${index}].min_percentage`,
        message: 'min_percentage must be less than max_percentage',
      });
      return;
    }

    rows.push(row);
  });

  if (errors.length) throw new ApiError(422, 'Validation failed', errors);
  return rows;
};

const loadBandsByScale = async (supabase, scaleIds) => {
  const grouped = {};
  if (!scaleIds.length) return grouped;

  const { data, error } = await supabase
    .from(GRADING_BANDS.table)
    .select(GRADING_BANDS.select)
    .in('grading_scale_id', scaleIds)
    .order('min_percentage', { ascending: false });

  if (error) throw error;

  (data || []).forEach((band) => {
    if (!grouped[band.grading_scale_id]) grouped[band.grading_scale_id] = [];
    grouped[band.grading_scale_id].push(band);
  });

  return grouped;
};

const listGradingScales = async ({ accessToken, query }) => {
  const supabase = createUserClient(accessToken);
  const result = await listResource(supabase, GRADING_SCALES, query);
  const grouped = await loadBandsByScale(
    supabase,
    result.items.map((scale) => scale.id)
  );

  return {
    ...result,
    items: result.items.map((scale) => ({ ...scale, bands: grouped[scale.id] || [] })),
  };
};

const clearDefaultScales = async (supabase, exceptId = null) => {
  let builder = supabase.from(GRADING_SCALES.table).update({ is_default: false }).eq('is_default', true);
  if (exceptId) builder = builder.neq('id', exceptId);
  const { error } = await builder;
  if (error) throw error;
};

const createGradingScale = async ({ accessToken, payload }) => {
  const supabase = createUserClient(accessToken);
  const row = normalizeFields(GRADING_SCALES, payload, { partial: false });
  const bands = normalizeBands(payload.bands);

  if (row.is_default) await clearDefaultScales(supabase);

  const { data: scale, error } = await supabase
    .from(GRADING_SCALES.table)
    .insert(row)
    .select(GRADING_SCALES.select)
    .single();

  if (error) throw error;

  let insertedBands = [];
  if (bands && bands.length) {
    const { data, error: bandError } = await supabase
      .from(GRADING_BANDS.table)
      .insert(bands.map((band) => ({ ...band, grading_scale_id: scale.id })))
      .select(GRADING_BANDS.select);
    if (bandError) throw bandError;
    insertedBands = data || [];
  }

  return { ...scale, bands: insertedBands };
};

const updateGradingScale = async ({ accessToken, id, payload }) => {
  const supabase = createUserClient(accessToken);
  const before = await resourceDetail(supabase, GRADING_SCALES, id, 'Grading scale not found');
  const changes = normalizeFields(GRADING_SCALES, payload, { partial: true });
  const bands = normalizeBands(payload.bands);

  if (changes.is_default === true) await clearDefaultScales(supabase, id);

  let after = before;
  if (Object.keys(changes).length > 0) {
    const { data, error } = await supabase
      .from(GRADING_SCALES.table)
      .update(changes)
      .eq('id', id)
      .select(GRADING_SCALES.select)
      .single();
    if (error) throw error;
    after = data;
  }

  let afterBands;
  if (bands !== null) {
    const { error: deleteError } = await supabase
      .from(GRADING_BANDS.table)
      .delete()
      .eq('grading_scale_id', id);
    if (deleteError) throw deleteError;

    if (bands.length) {
      const { data, error: insertError } = await supabase
        .from(GRADING_BANDS.table)
        .insert(bands.map((band) => ({ ...band, grading_scale_id: id })))
        .select(GRADING_BANDS.select);
      if (insertError) throw insertError;
      afterBands = data || [];
    } else {
      afterBands = [];
    }
  }

  if (afterBands === undefined) {
    afterBands = (await loadBandsByScale(supabase, [id]))[id] || [];
  }

  return { before, after: { ...after, bands: afterBands }, changes };
};

const removeGradingScale = async ({ accessToken, id }) => {
  const supabase = createUserClient(accessToken);
  return removeResource(supabase, GRADING_SCALES, id, 'Grading scale not found');
};

// Resolves the institution's active default grading scheme, falling back to the
// built-in scheme so grades always compute even before configuration.
const loadActiveBands = async (supabase) => {
  const { data: scales, error } = await supabase
    .from(GRADING_SCALES.table)
    .select('id, name, is_default, status')
    .eq('status', 'active')
    .order('is_default', { ascending: false })
    .limit(20);

  if (error) throw error;

  if (!scales || scales.length === 0) {
    return { scale: null, bands: DEFAULT_GRADING_BANDS };
  }

  const scale = scales.find((row) => row.is_default) || scales[0];
  const { data: bands, error: bandError } = await supabase
    .from(GRADING_BANDS.table)
    .select(GRADING_BANDS.select)
    .eq('grading_scale_id', scale.id)
    .order('min_percentage', { ascending: false });

  if (bandError) throw bandError;

  if (!bands || bands.length === 0) {
    return { scale, bands: DEFAULT_GRADING_BANDS };
  }

  return { scale, bands };
};

const resolveGrade = (bands, percentage) => {
  if (!Array.isArray(bands) || bands.length === 0) return null;

  const sorted = [...bands].sort(
    (a, b) => Number(b.min_percentage) - Number(a.min_percentage)
  );

  return (
    sorted.find(
      (band) =>
        percentage >= Number(band.min_percentage) && percentage <= Number(band.max_percentage)
    ) || sorted[sorted.length - 1]
  );
};

// Computes a single student's result for one exam.
const computeExamResult = (exam, mark, bands, fallbackPass = DEFAULT_PASS_PERCENTAGE) => {
  const maxMarks = Number(exam.max_marks) || 0;
  const isAbsent = Boolean(mark?.is_absent);
  const hasMark = mark && mark.marks_obtained !== null && mark.marks_obtained !== undefined;
  const obtained = isAbsent ? 0 : hasMark ? Number(mark.marks_obtained) : null;

  if (obtained === null) {
    return {
      marks_obtained: null,
      is_absent: isAbsent,
      max_marks: maxMarks,
      percentage: null,
      grade: null,
      grade_point: null,
      is_pass: null,
      graded: false,
    };
  }

  const percentage = maxMarks > 0 ? round2((obtained / maxMarks) * 100) : 0;
  const band = resolveGrade(bands, percentage);
  const passMarks =
    exam.pass_marks !== null && exam.pass_marks !== undefined ? Number(exam.pass_marks) : null;

  const isPass = isAbsent
    ? false
    : passMarks !== null
      ? obtained >= passMarks
      : band
        ? Boolean(band.is_pass)
        : percentage >= fallbackPass;

  return {
    marks_obtained: obtained,
    is_absent: isAbsent,
    max_marks: maxMarks,
    percentage,
    grade: band ? band.grade_label : null,
    grade_point: band && band.grade_point !== null ? Number(band.grade_point) : null,
    is_pass: isPass,
    graded: true,
  };
};

// ---------------------------------------------------------------------------
// Exams
// ---------------------------------------------------------------------------
const listExams = async ({ accessToken, query }) => {
  const supabase = createUserClient(accessToken);
  return listResource(supabase, EXAMS, query);
};

const examDetail = async ({ accessToken, id }) => {
  const supabase = createUserClient(accessToken);
  return resourceDetail(supabase, EXAMS, id, 'Exam not found');
};

const createExam = async ({ accessToken, payload }) => {
  const supabase = createUserClient(accessToken);
  const row = normalizeFields(EXAMS, payload, { partial: false });

  const { data, error } = await supabase
    .from(EXAMS.table)
    .insert(row)
    .select(EXAMS.select)
    .single();

  if (error) throw error;
  return data;
};

const updateExam = async ({ accessToken, id, payload }) => {
  const supabase = createUserClient(accessToken);
  const before = await resourceDetail(supabase, EXAMS, id, 'Exam not found');
  const changes = normalizeFields(EXAMS, payload, { partial: true });

  if (Object.keys(changes).length === 0) {
    return { before, after: before, changes };
  }

  const { data: after, error } = await supabase
    .from(EXAMS.table)
    .update(changes)
    .eq('id', id)
    .select(EXAMS.select)
    .single();

  if (error) throw error;
  return { before, after, changes };
};

const removeExam = async ({ accessToken, id }) => {
  const supabase = createUserClient(accessToken);
  return removeResource(supabase, EXAMS, id, 'Exam not found');
};

// ---------------------------------------------------------------------------
// Marks
// ---------------------------------------------------------------------------
const MARKS_SELECT =
  'id, exam_id, student_id, marks_obtained, is_absent, remarks, graded_by, created_at, updated_at, ' +
  'student:students!student_id ( id, admission_number, first_name, last_name )';

const listMarks = async ({ accessToken, examId }) => {
  const supabase = createUserClient(accessToken);
  const exam = await resourceDetail(supabase, EXAMS, examId, 'Exam not found');

  const { data, error } = await supabase
    .from('exam_marks')
    .select(MARKS_SELECT)
    .eq('exam_id', examId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return { exam, marks: data || [] };
};

const normalizeMarkRecord = (record, index, examId, maxMarks, actorId, errors) => {
  if (!UUID_RE.test(String(record?.student_id || ''))) {
    errors.push({ field: `records[${index}].student_id`, message: 'must be a valid student id' });
    return null;
  }

  const isAbsent =
    record.is_absent === true || ['true', '1', 'yes'].includes(String(record.is_absent).toLowerCase());

  let marks = record.marks_obtained;

  if (isAbsent) {
    marks = null;
  } else if (marks === null || marks === undefined || marks === '') {
    marks = null;
  } else {
    const value = Number(marks);
    if (!Number.isFinite(value) || value < 0) {
      errors.push({
        field: `records[${index}].marks_obtained`,
        message: 'must be a non-negative number',
      });
      return null;
    }
    if (maxMarks !== null && value > maxMarks) {
      errors.push({
        field: `records[${index}].marks_obtained`,
        message: `cannot exceed the exam maximum of ${maxMarks}`,
      });
      return null;
    }
    marks = value;
  }

  return {
    exam_id: examId,
    student_id: record.student_id,
    marks_obtained: marks,
    is_absent: isAbsent,
    remarks: record.remarks ? String(record.remarks).slice(0, 500) : null,
    graded_by: actorId || null,
  };
};

// Bulk create/update marks. Upserts on (exam_id, student_id) so re-submitting a
// roster edits existing rows instead of duplicating them.
const saveMarks = async ({ accessToken, examId, records, actorId }) => {
  if (!Array.isArray(records) || records.length === 0) {
    throw new ApiError(422, 'Validation failed', [
      { field: 'records', message: 'records must be a non-empty array' },
    ]);
  }

  const supabase = createUserClient(accessToken);
  const exam = await resourceDetail(supabase, EXAMS, examId, 'Exam not found');
  const maxMarks = Number(exam.max_marks);

  const errors = [];
  const rows = [];

  records.forEach((record, index) => {
    const row = normalizeMarkRecord(record, index, examId, maxMarks, actorId, errors);
    if (row) rows.push(row);
  });

  if (errors.length) throw new ApiError(422, 'Validation failed', errors);

  const { data, error } = await supabase
    .from('exam_marks')
    .upsert(rows, { onConflict: 'exam_id,student_id' })
    .select(MARKS_SELECT);

  if (error) throw error;
  return data || [];
};

// ---------------------------------------------------------------------------
// Exam-wise results (ranked)
// ---------------------------------------------------------------------------
const examResults = async ({ accessToken, examId }) => {
  const supabase = createUserClient(accessToken);
  const exam = await resourceDetail(supabase, EXAMS, examId, 'Exam not found');
  const { scale, bands } = await loadActiveBands(supabase);

  const { data, error } = await supabase
    .from('exam_marks')
    .select(MARKS_SELECT)
    .eq('exam_id', examId);

  if (error) throw error;

  const students = (data || [])
    .map((mark) => ({
      student_id: mark.student_id,
      student: mark.student,
      ...computeExamResult(exam, mark, bands),
    }))
    .sort((a, b) => (b.percentage ?? -1) - (a.percentage ?? -1))
    .map((row, index) => ({ ...row, rank: index + 1 }));

  return { exam, grading_scale: scale, students };
};

module.exports = {
  listExamTypes,
  createExamType,
  updateExamType,
  removeExamType,
  listGradingScales,
  createGradingScale,
  updateGradingScale,
  removeGradingScale,
  listExams,
  examDetail,
  createExam,
  updateExam,
  removeExam,
  listMarks,
  saveMarks,
  examResults,
  loadActiveBands,
  resolveGrade,
  computeExamResult,
};
