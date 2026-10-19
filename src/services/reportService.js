const { createUserClient } = require('../config/supabase');

const studentsReport = async ({ accessToken }) => {
  const supabase = createUserClient(accessToken);
  const { data: students, error } = await supabase
    .from('students')
    .select('id, admission_number, first_name, last_name, email, phone, status, department_id, department:departments!department_id(name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return { students: students || [] };
};

const facultyReport = async ({ accessToken }) => {
  const supabase = createUserClient(accessToken);
  const { data: faculty, error } = await supabase
    .from('faculty')
    .select('id, employee_id, first_name, last_name, email, phone, status, designation, department_id, department:departments!department_id(name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return { faculty: faculty || [] };
};

const attendanceReport = async ({ accessToken, query = {} }) => {
  const supabase = createUserClient(accessToken);
  let builder = supabase
    .from('attendance_records')
    .select('id, status, session_id, session:attendance_sessions!session_id(session_date, class_id, class:classes!class_id(name,section)), student_id, student:students!student_id(admission_number, first_name, last_name)');
  if (query.class_id) builder = builder.eq('session.class_id', query.class_id);
  if (query.from) builder = builder.gte('session.session_date', query.from);
  if (query.to) builder = builder.lte('session.session_date', query.to);
  if (query.status) builder = builder.eq('status', query.status);
  const { data, error } = await builder.order('created_at', { ascending: false });
  if (error) throw error;
  return { records: data || [] };
};

const examsResultsReport = async ({ accessToken, query = {} }) => {
  const supabase = createUserClient(accessToken);
  let builder = supabase
    .from('exam_marks')
    .select('id, marks_obtained, is_absent, remarks, exam_id, exam:exams!exam_id(name, max_marks, exam_type_id, exam_type:exam_types!exam_type_id(name), class_id, class:classes!class_id(name,section), academic_year_id, academic_year:academic_years!academic_year_id(name)), student_id, student:students!student_id(admission_number, first_name, last_name)')
    .order('created_at', { ascending: false });
  if (query.class_id) builder = builder.eq('exam.class_id', query.class_id);
  if (query.academic_year_id) builder = builder.eq('exam.academic_year_id', query.academic_year_id);
  const { data, error } = await builder;
  if (error) throw error;
  return { marks: data || [] };
};

module.exports = { studentsReport, facultyReport, attendanceReport, examsResultsReport };
