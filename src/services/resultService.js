const ApiError = require('../utils/ApiError');
const { createUserClient } = require('../config/supabase');
const {
  loadActiveBands,
  resolveGrade,
  computeExamResult,
} = require('./examService');
const { EXAMS, DEFAULT_PASS_PERCENTAGE } = require('../config/exams');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const round2 = (value) => Math.round(value * 100) / 100;

const assertUuid = (value, field) => {
  if (!UUID_RE.test(String(value || ''))) {
    throw new ApiError(422, 'Validation failed', [
      { field, message: `${field} must be a valid id` },
    ]);
  }
};

const EXAM_RELATION =
  'exam:exams!exam_id ( id, name, exam_date, max_marks, pass_marks, status, academic_year_id, term_id, class_id, subject_id, ' +
  'exam_type:exam_types!exam_type_id ( id, name ), ' +
  'term:terms!term_id ( id, name ), ' +
  'class:classes!class_id ( id, name, section ), ' +
  'subject:subjects!subject_id ( id, name ), ' +
  'academic_year:academic_years!academic_year_id ( id, name ) )';

const MARKS_SELECT =
  'id, exam_id, student_id, marks_obtained, is_absent, remarks, ' +
  'student:students!student_id ( id, admission_number, first_name, last_name )';

// Aggregates a set of per-exam result rows into a student summary.
const summarize = (rows, bands) => {
  const graded = rows.filter((row) => row.graded);
  const obtained = round2(graded.reduce((sum, row) => sum + (row.marks_obtained || 0), 0));
  const totalMax = round2(graded.reduce((sum, row) => sum + row.max_marks, 0));
  const percentage = totalMax > 0 ? round2((obtained / totalMax) * 100) : null;
  const band = percentage !== null ? resolveGrade(bands, percentage) : null;
  const failed = graded.filter((row) => row.is_pass === false).length;

  return {
    total_exams: rows.length,
    graded_exams: graded.length,
    failed_exams: failed,
    obtained_marks: obtained,
    total_max_marks: totalMax,
    percentage,
    grade: band ? band.grade_label : null,
    grade_point: band && band.grade_point !== null ? Number(band.grade_point) : null,
    is_pass: graded.length ? failed === 0 : null,
  };
};

const buildExamSummary = (exams) =>
  exams.map((exam) => ({
    id: exam.id,
    name: exam.name,
    exam_date: exam.exam_date,
    max_marks: Number(exam.max_marks),
    pass_marks: exam.pass_marks !== null ? Number(exam.pass_marks) : null,
    status: exam.status,
    exam_type: exam.exam_type || null,
    subject: exam.subject || null,
    class: exam.class || null,
  }));

// ---------------------------------------------------------------------------
// Class-wise results: every enrolled student plus anyone with recorded marks.
// ---------------------------------------------------------------------------
const classResults = async ({ accessToken, classId, query = {} }) => {
  assertUuid(classId, 'class_id');
  const supabase = createUserClient(accessToken);

  const { data: klass, error: classError } = await supabase
    .from('classes')
    .select('id, name, section, course:courses!course_id ( id, name )')
    .eq('id', classId)
    .maybeSingle();

  if (classError) throw classError;
  if (!klass) throw new ApiError(404, 'Class not found');

  let examQuery = supabase.from(EXAMS.table).select(EXAMS.select).eq('class_id', classId);
  if (query.exam_id) examQuery = examQuery.eq('id', query.exam_id);
  if (query.term_id) examQuery = examQuery.eq('term_id', query.term_id);
  if (query.academic_year_id) examQuery = examQuery.eq('academic_year_id', query.academic_year_id);
  if (query.subject_id) examQuery = examQuery.eq('subject_id', query.subject_id);

  const { data: exams, error: examError } = await examQuery.order('exam_date', {
    ascending: true,
  });
  if (examError) throw examError;

  const examMap = new Map((exams || []).map((exam) => [exam.id, exam]));
  const { scale, bands } = await loadActiveBands(supabase);

  const studentMap = new Map();

  const { data: enrollments, error: enrollError } = await supabase
    .from('enrollments')
    .select(
      'student_id, status, ' +
        'student:students!student_id ( id, admission_number, first_name, last_name )'
    )
    .eq('class_id', classId);
  if (enrollError) throw enrollError;

  (enrollments || [])
    .filter((row) => row.status === 'enrolled' && row.student)
    .forEach((row) => studentMap.set(row.student_id, row.student));

  let marks = [];
  if (examMap.size > 0) {
    const { data: markRows, error: markError } = await supabase
      .from('exam_marks')
      .select(MARKS_SELECT)
      .in('exam_id', Array.from(examMap.keys()));
    if (markError) throw markError;
    marks = markRows || [];
    marks.forEach((mark) => {
      if (mark.student) studentMap.set(mark.student_id, mark.student);
    });
  }

  const byStudent = new Map();
  marks.forEach((mark) => {
    if (!byStudent.has(mark.student_id)) byStudent.set(mark.student_id, []);
    byStudent.get(mark.student_id).push(mark);
  });

  let rank = 0;
  const students = Array.from(studentMap.entries())
    .map(([studentId, student]) => {
      const rows = (byStudent.get(studentId) || []).map((mark) => {
        const exam = examMap.get(mark.exam_id) || { max_marks: 0 };
        return { exam_id: mark.exam_id, ...computeExamResult(exam, mark, bands) };
      });
      return { student_id: studentId, student, ...summarize(rows, bands) };
    })
    .sort((a, b) => (b.percentage ?? -1) - (a.percentage ?? -1))
    .map((row) => {
      if (row.percentage !== null) rank += 1;
      return { ...row, rank: row.percentage !== null ? rank : null };
    });

  return {
    class: klass,
    grading_scale: scale,
    exams: buildExamSummary(exams || []),
    students,
  };
};

// ---------------------------------------------------------------------------
// Student-wise results & report card.
// ---------------------------------------------------------------------------
const studentResults = async ({ accessToken, studentId, query = {} }) => {
  assertUuid(studentId, 'student_id');
  const supabase = createUserClient(accessToken);

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select(
      'id, admission_number, first_name, last_name, department:departments!department_id ( id, name )'
    )
    .eq('id', studentId)
    .maybeSingle();

  if (studentError) throw studentError;
  if (!student) throw new ApiError(404, 'Student not found');

  const { data, error } = await supabase
    .from('exam_marks')
    .select(`id, exam_id, student_id, marks_obtained, is_absent, remarks, ${EXAM_RELATION}`)
    .eq('student_id', studentId);

  if (error) throw error;

  const { scale, bands } = await loadActiveBands(supabase);

  const rows = (data || [])
    .filter((mark) => mark.exam)
    .filter((mark) => !query.class_id || mark.exam.class_id === query.class_id)
    .filter((mark) => !query.exam_id || mark.exam_id === query.exam_id)
    .filter((mark) => !query.term_id || mark.exam.term_id === query.term_id)
    .filter((mark) => !query.academic_year_id || mark.exam.academic_year_id === query.academic_year_id)
    .filter((mark) => !query.subject_id || mark.exam.subject_id === query.subject_id)
    .map((mark) => ({
      exam_id: mark.exam_id,
      exam_name: mark.exam.name,
      exam_date: mark.exam.exam_date,
      status: mark.exam.status,
      exam_type: mark.exam.exam_type || null,
      term: mark.exam.term || null,
      subject: mark.exam.subject || null,
      class: mark.exam.class || null,
      academic_year: mark.exam.academic_year || null,
      remarks: mark.remarks || null,
      ...computeExamResult(mark.exam, mark, bands),
    }))
    .sort((a, b) => String(a.exam_date || '').localeCompare(String(b.exam_date || '')));

  return {
    student,
    grading_scale: scale,
    pass_percentage: DEFAULT_PASS_PERCENTAGE,
    exams: rows,
    summary: summarize(rows, bands),
  };
};

// ---------------------------------------------------------------------------
// Dispatcher used by GET /results.
// ---------------------------------------------------------------------------
const results = async ({ accessToken, query = {} }) => {
  if (query.student_id) {
    const data = await studentResults({ accessToken, studentId: query.student_id, query });
    return { mode: 'student', ...data };
  }

  if (query.class_id) {
    const data = await classResults({ accessToken, classId: query.class_id, query });
    return { mode: 'class', ...data };
  }

  throw new ApiError(422, 'Validation failed', [
    { field: 'class_id', message: 'Provide class_id or student_id to load results' },
  ]);
};

module.exports = {
  results,
  classResults,
  studentResults,
  summarize,
};
