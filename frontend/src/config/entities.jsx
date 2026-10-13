import {
  Users,
  UserCheck,
  Building2,
  BookOpen,
  Library,
  Layers,
  ClipboardList,
  CalendarRange,
  CalendarClock,
} from 'lucide-react';

const STUDENT_STATUSES = ['active', 'inactive', 'graduated', 'suspended', 'withdrawn'];
const FACULTY_STATUSES = ['active', 'inactive', 'on_leave', 'terminated'];
const ACTIVE_INACTIVE = ['active', 'inactive'];
const CLASS_STATUSES = ['active', 'inactive', 'archived'];
const ENROLLMENT_STATUSES = ['enrolled', 'dropped', 'completed'];

const statusOptions = (values) => values.map((value) => ({ value, label: value.replace(/_/g, ' ') }));

export const ENTITIES = {
  students: {
    title: 'Students',
    singular: 'Student',
    description: 'Admission records, contact details and enrollment status.',
    icon: Users,
    searchPlaceholder: 'Search by name, admission number or email',
    columns: [
      { key: 'admission_number', label: 'Admission #' },
      { key: 'name', label: 'Name', render: (row) => `${row.first_name || ''} ${row.last_name || ''}`.trim() || '—' },
      { key: 'email', label: 'Email', render: (row) => row.email || '—' },
      { key: 'department', label: 'Department', render: (row) => row.department?.name || '—' },
      { key: 'status', label: 'Status' },
    ],
    filters: [
      { name: 'status', label: 'Status', options: statusOptions(STUDENT_STATUSES) },
      { name: 'department_id', label: 'Department', ref: 'departments' },
      { name: 'gender', label: 'Gender', options: statusOptions(['male', 'female', 'other']) },
    ],
    fields: [
      { name: 'admission_number', label: 'Admission Number', input: 'text', required: true },
      { name: 'first_name', label: 'First Name', input: 'text', required: true },
      { name: 'last_name', label: 'Last Name', input: 'text', required: true },
      { name: 'email', label: 'Email', input: 'email' },
      { name: 'phone', label: 'Phone', input: 'tel' },
      { name: 'date_of_birth', label: 'Date of Birth', input: 'date' },
      { name: 'gender', label: 'Gender', input: 'select', options: statusOptions(['male', 'female', 'other']) },
      { name: 'department_id', label: 'Department', input: 'ref', ref: 'departments' },
      { name: 'admission_date', label: 'Admission Date', input: 'date' },
      { name: 'status', label: 'Status', input: 'select', options: statusOptions(STUDENT_STATUSES), default: 'active' },
      { name: 'guardian_name', label: 'Guardian Name', input: 'text' },
      { name: 'guardian_phone', label: 'Guardian Phone', input: 'tel' },
      { name: 'address', label: 'Address', input: 'textarea' },
    ],
  },

  faculty: {
    title: 'Faculty',
    singular: 'Faculty Member',
    description: 'Employee records, designations and department assignments.',
    icon: UserCheck,
    searchPlaceholder: 'Search by name, employee ID or email',
    columns: [
      { key: 'employee_id', label: 'Employee ID' },
      { key: 'name', label: 'Name', render: (row) => `${row.first_name || ''} ${row.last_name || ''}`.trim() || '—' },
      { key: 'designation', label: 'Designation', render: (row) => row.designation || '—' },
      { key: 'department', label: 'Department', render: (row) => row.department?.name || '—' },
      { key: 'status', label: 'Status' },
    ],
    filters: [
      { name: 'status', label: 'Status', options: statusOptions(FACULTY_STATUSES) },
      { name: 'department_id', label: 'Department', ref: 'departments' },
    ],
    fields: [
      { name: 'employee_id', label: 'Employee ID', input: 'text', required: true },
      { name: 'first_name', label: 'First Name', input: 'text', required: true },
      { name: 'last_name', label: 'Last Name', input: 'text', required: true },
      { name: 'email', label: 'Email', input: 'email' },
      { name: 'phone', label: 'Phone', input: 'tel' },
      { name: 'designation', label: 'Designation', input: 'text' },
      { name: 'department_id', label: 'Department', input: 'ref', ref: 'departments' },
      { name: 'hired_date', label: 'Hired Date', input: 'date' },
      { name: 'status', label: 'Status', input: 'select', options: statusOptions(FACULTY_STATUSES), default: 'active' },
    ],
  },

  departments: {
    title: 'Departments',
    singular: 'Department',
    description: 'Academic departments and their codes.',
    icon: Building2,
    searchPlaceholder: 'Search by name or code',
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'code', label: 'Code', render: (row) => row.code || '—' },
    ],
    filters: [],
    fields: [
      { name: 'name', label: 'Name', input: 'text', required: true },
      { name: 'code', label: 'Code', input: 'text' },
    ],
  },

  courses: {
    title: 'Courses',
    singular: 'Course',
    description: 'Course catalog mapped to departments and subjects.',
    icon: BookOpen,
    searchPlaceholder: 'Search by name or code',
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'code', label: 'Code', render: (row) => row.code || '—' },
      { key: 'department', label: 'Department', render: (row) => row.department?.name || '—' },
      { key: 'subject', label: 'Subject', render: (row) => row.subject?.name || '—' },
      { key: 'status', label: 'Status' },
    ],
    filters: [
      { name: 'status', label: 'Status', options: statusOptions(ACTIVE_INACTIVE) },
      { name: 'department_id', label: 'Department', ref: 'departments' },
      { name: 'subject_id', label: 'Subject', ref: 'subjects' },
    ],
    fields: [
      { name: 'name', label: 'Name', input: 'text', required: true },
      { name: 'code', label: 'Code', input: 'text' },
      { name: 'department_id', label: 'Department', input: 'ref', ref: 'departments' },
      { name: 'subject_id', label: 'Subject', input: 'ref', ref: 'subjects' },
      { name: 'credit_hours', label: 'Credit Hours', input: 'number', step: '0.5' },
      { name: 'level', label: 'Level', input: 'text' },
      { name: 'status', label: 'Status', input: 'select', options: statusOptions(ACTIVE_INACTIVE), default: 'active' },
      { name: 'description', label: 'Description', input: 'textarea' },
    ],
  },

  subjects: {
    title: 'Subjects',
    singular: 'Subject',
    description: 'Subjects taught within each department.',
    icon: Library,
    searchPlaceholder: 'Search by name or code',
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'code', label: 'Code', render: (row) => row.code || '—' },
      { key: 'department', label: 'Department', render: (row) => row.department?.name || '—' },
      { key: 'credit_hours', label: 'Credits', render: (row) => row.credit_hours ?? '—' },
      { key: 'status', label: 'Status' },
    ],
    filters: [
      { name: 'status', label: 'Status', options: statusOptions(ACTIVE_INACTIVE) },
      { name: 'department_id', label: 'Department', ref: 'departments' },
    ],
    fields: [
      { name: 'name', label: 'Name', input: 'text', required: true },
      { name: 'code', label: 'Code', input: 'text' },
      { name: 'department_id', label: 'Department', input: 'ref', ref: 'departments' },
      { name: 'credit_hours', label: 'Credit Hours', input: 'number', step: '0.5' },
      { name: 'status', label: 'Status', input: 'select', options: statusOptions(ACTIVE_INACTIVE), default: 'active' },
      { name: 'description', label: 'Description', input: 'textarea' },
    ],
  },

  classes: {
    title: 'Classes',
    singular: 'Class',
    description: 'Class sections, assigned faculty, rooms and schedules.',
    icon: Layers,
    searchPlaceholder: 'Search by name, section or room',
    columns: [
      { key: 'name', label: 'Class' },
      { key: 'section', label: 'Section', render: (row) => row.section || '—' },
      { key: 'course', label: 'Course', render: (row) => row.course?.name || '—' },
      { key: 'term', label: 'Term', render: (row) => row.term?.name || '—' },
      { key: 'faculty', label: 'Faculty', render: (row) => (row.faculty ? `${row.faculty.first_name || ''} ${row.faculty.last_name || ''}`.trim() : '—') },
      { key: 'status', label: 'Status' },
    ],
    filters: [
      { name: 'status', label: 'Status', options: statusOptions(CLASS_STATUSES) },
      { name: 'course_id', label: 'Course', ref: 'courses' },
      { name: 'term_id', label: 'Term', ref: 'terms' },
      { name: 'faculty_id', label: 'Faculty', ref: 'faculty' },
    ],
    fields: [
      { name: 'name', label: 'Class Name', input: 'text', required: true },
      { name: 'course_id', label: 'Course', input: 'ref', ref: 'courses', required: true },
      { name: 'term_id', label: 'Term', input: 'ref', ref: 'terms' },
      { name: 'subject_id', label: 'Subject', input: 'ref', ref: 'subjects' },
      { name: 'faculty_id', label: 'Faculty', input: 'ref', ref: 'faculty' },
      { name: 'section', label: 'Section', input: 'text' },
      { name: 'room', label: 'Room', input: 'text' },
      { name: 'capacity', label: 'Capacity', input: 'number', min: '1' },
      { name: 'schedule', label: 'Schedule', input: 'text' },
      { name: 'status', label: 'Status', input: 'select', options: statusOptions(CLASS_STATUSES), default: 'active' },
    ],
  },

  enrollments: {
    title: 'Enrollments',
    singular: 'Enrollment',
    description: 'Enroll students into class sections.',
    icon: ClipboardList,
    searchPlaceholder: 'Search enrollments',
    columns: [
      { key: 'student', label: 'Student', render: (row) => (row.student ? `${row.student.first_name || ''} ${row.student.last_name || ''} (${row.student.admission_number || ''})`.trim() : '—') },
      { key: 'class', label: 'Class', render: (row) => (row.class ? `${row.class.name || ''}${row.class.section ? ` (${row.class.section})` : ''}` : '—') },
      { key: 'status', label: 'Status' },
      { key: 'enrolled_at', label: 'Enrolled', render: (row) => (row.enrolled_at ? new Date(row.enrolled_at).toLocaleDateString() : '—') },
    ],
    filters: [
      { name: 'status', label: 'Status', options: statusOptions(ENROLLMENT_STATUSES) },
      { name: 'class_id', label: 'Class', ref: 'classes' },
      { name: 'student_id', label: 'Student', ref: 'students' },
    ],
    fields: [
      { name: 'class_id', label: 'Class', input: 'ref', ref: 'classes', required: true },
      { name: 'student_id', label: 'Student', input: 'ref', ref: 'students', required: true },
      { name: 'status', label: 'Status', input: 'select', options: statusOptions(ENROLLMENT_STATUSES), default: 'enrolled' },
    ],
  },

  'academic-years': {
    title: 'Academic Years',
    singular: 'Academic Year',
    description: 'Academic year periods used to schedule terms and classes.',
    icon: CalendarRange,
    searchPlaceholder: 'Search by name',
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'start_date', label: 'Start', render: (row) => row.start_date || '—' },
      { key: 'end_date', label: 'End', render: (row) => row.end_date || '—' },
      { key: 'is_current', label: 'Current', render: (row) => (row.is_current ? 'Yes' : 'No') },
    ],
    filters: [],
    fields: [
      { name: 'name', label: 'Name', input: 'text', required: true },
      { name: 'start_date', label: 'Start Date', input: 'date', required: true },
      { name: 'end_date', label: 'End Date', input: 'date', required: true },
      { name: 'is_current', label: 'Current Year', input: 'checkbox', default: false },
    ],
  },

  terms: {
    title: 'Terms',
    singular: 'Term',
    description: 'Terms within each academic year.',
    icon: CalendarClock,
    searchPlaceholder: 'Search by name',
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'academic_year', label: 'Academic Year', render: (row) => row.academic_year?.name || '—' },
      { key: 'term_number', label: 'Number' },
      { key: 'is_current', label: 'Current', render: (row) => (row.is_current ? 'Yes' : 'No') },
    ],
    filters: [
      { name: 'academic_year_id', label: 'Academic Year', ref: 'academic-years' },
    ],
    fields: [
      { name: 'academic_year_id', label: 'Academic Year', input: 'ref', ref: 'academic-years', required: true },
      { name: 'name', label: 'Name', input: 'text', required: true },
      { name: 'term_number', label: 'Term Number', input: 'number', required: true, min: '1' },
      { name: 'start_date', label: 'Start Date', input: 'date' },
      { name: 'end_date', label: 'End Date', input: 'date' },
      { name: 'is_current', label: 'Current Term', input: 'checkbox', default: false },
    ],
  },
};

export const RESOURCE_ORDER = [
  'students',
  'faculty',
  'departments',
  'courses',
  'subjects',
  'classes',
  'enrollments',
  'academic-years',
  'terms',
];

// Human-readable label for a referenced record, used in dropdowns.
export const lookupLabel = (resource, row) => {
  switch (resource) {
    case 'faculty':
      return [row.first_name, row.last_name].filter(Boolean).join(' ') || row.employee_id;
    case 'students':
      return `${row.admission_number || ''} — ${[row.first_name, row.last_name].filter(Boolean).join(' ')}`.trim();
    case 'classes':
      return row.section ? `${row.name} (${row.section})` : row.name;
    case 'subjects':
    case 'courses':
      return row.code ? `${row.name} (${row.code})` : row.name;
    default:
      return row.name;
  }
};
