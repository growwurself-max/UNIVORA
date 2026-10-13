// Declarative definitions for every institution-scoped academic resource.
// The generic resource service/controller use these to build RLS-scoped CRUD
// endpoints, so new resources only need a config entry (plus their migration).

const statusField = (values, defaultValue = 'active') => ({
  type: 'enum',
  values,
  default: defaultValue,
});

const RESOURCES = {
  departments: {
    table: 'departments',
    select: 'id, institution_id, name, code, head_profile_id, created_at, updated_at',
    searchable: ['name', 'code'],
    filters: ['code'],
    fields: {
      name: { type: 'string', required: true, max: 150 },
      code: { type: 'string', max: 30, uppercase: true },
      head_profile_id: { type: 'uuid' },
    },
  },

  'academic-years': {
    table: 'academic_years',
    select: 'id, institution_id, name, start_date, end_date, is_current, created_at, updated_at',
    searchable: ['name'],
    filters: ['is_current'],
    fields: {
      name: { type: 'string', required: true, max: 100 },
      start_date: { type: 'date', required: true },
      end_date: { type: 'date', required: true },
      is_current: { type: 'boolean', default: false },
    },
  },

  terms: {
    table: 'terms',
    select:
      'id, institution_id, academic_year_id, name, term_number, start_date, end_date, is_current, created_at, updated_at, ' +
      'academic_year:academic_years!academic_year_id ( id, name )',
    searchable: ['name'],
    filters: ['academic_year_id', 'is_current'],
    fields: {
      academic_year_id: { type: 'uuid', required: true },
      name: { type: 'string', required: true, max: 100 },
      term_number: { type: 'number', required: true, integer: true, min: 1, max: 20 },
      start_date: { type: 'date' },
      end_date: { type: 'date' },
      is_current: { type: 'boolean', default: false },
    },
    refs: [['academic_year_id', 'academic-years']],
  },

  subjects: {
    table: 'subjects',
    select:
      'id, institution_id, department_id, name, code, credit_hours, description, status, created_at, updated_at, ' +
      'department:departments!department_id ( id, name )',
    searchable: ['name', 'code'],
    filters: ['status', 'department_id'],
    fields: {
      name: { type: 'string', required: true, max: 150 },
      code: { type: 'string', max: 30, uppercase: true },
      department_id: { type: 'uuid' },
      credit_hours: { type: 'number', min: 0, max: 60 },
      description: { type: 'string', max: 1000 },
      status: statusField(['active', 'inactive']),
    },
    refs: [['department_id', 'departments']],
  },

  courses: {
    table: 'courses',
    select:
      'id, institution_id, department_id, subject_id, name, code, credit_hours, level, description, status, created_at, updated_at, ' +
      'department:departments!department_id ( id, name ), ' +
      'subject:subjects!subject_id ( id, name, code )',
    searchable: ['name', 'code'],
    filters: ['status', 'department_id', 'subject_id'],
    fields: {
      name: { type: 'string', required: true, max: 150 },
      code: { type: 'string', max: 30, uppercase: true },
      department_id: { type: 'uuid' },
      subject_id: { type: 'uuid' },
      credit_hours: { type: 'number', min: 0, max: 60 },
      level: { type: 'string', max: 50 },
      description: { type: 'string', max: 1000 },
      status: statusField(['active', 'inactive']),
    },
  },

  faculty: {
    table: 'faculty',
    select:
      'id, institution_id, profile_id, employee_id, first_name, last_name, email, phone, department_id, designation, status, hired_date, created_at, updated_at, ' +
      'department:departments!department_id ( id, name )',
    searchable: ['employee_id', 'first_name', 'last_name', 'email'],
    filters: ['status', 'department_id', 'designation'],
    fields: {
      employee_id: { type: 'string', required: true, max: 50 },
      first_name: { type: 'string', required: true, max: 100 },
      last_name: { type: 'string', required: true, max: 100 },
      email: { type: 'email', max: 255 },
      phone: { type: 'string', max: 30 },
      department_id: { type: 'uuid' },
      designation: { type: 'string', max: 100 },
      status: statusField(['active', 'inactive', 'on_leave', 'terminated']),
      hired_date: { type: 'date' },
      profile_id: { type: 'uuid' },
    },
  },

  students: {
    table: 'students',
    select:
      'id, institution_id, profile_id, admission_number, first_name, last_name, email, phone, date_of_birth, gender, address, guardian_name, guardian_phone, department_id, status, admission_date, created_at, updated_at, ' +
      'department:departments!department_id ( id, name )',
    searchable: ['admission_number', 'first_name', 'last_name', 'email'],
    filters: ['status', 'department_id', 'gender'],
    fields: {
      admission_number: { type: 'string', required: true, max: 50 },
      first_name: { type: 'string', required: true, max: 100 },
      last_name: { type: 'string', required: true, max: 100 },
      email: { type: 'email', max: 255 },
      phone: { type: 'string', max: 30 },
      date_of_birth: { type: 'date' },
      gender: { type: 'enum', values: ['male', 'female', 'other'] },
      address: { type: 'string', max: 500 },
      guardian_name: { type: 'string', max: 150 },
      guardian_phone: { type: 'string', max: 30 },
      department_id: { type: 'uuid' },
      status: statusField(['active', 'inactive', 'graduated', 'suspended', 'withdrawn']),
      admission_date: { type: 'date' },
      profile_id: { type: 'uuid' },
    },
  },

  classes: {
    table: 'classes',
    select:
      'id, institution_id, course_id, term_id, subject_id, faculty_id, name, section, room, capacity, schedule, status, created_at, updated_at, ' +
      'course:courses!course_id ( id, name, code ), ' +
      'term:terms!term_id ( id, name ), ' +
      'subject:subjects!subject_id ( id, name ), ' +
      'faculty:faculty!faculty_id ( id, first_name, last_name )',
    searchable: ['name', 'section', 'room'],
    filters: ['status', 'course_id', 'term_id', 'faculty_id'],
    fields: {
      name: { type: 'string', required: true, max: 100 },
      course_id: { type: 'uuid', required: true },
      term_id: { type: 'uuid' },
      subject_id: { type: 'uuid' },
      faculty_id: { type: 'uuid' },
      section: { type: 'string', max: 50 },
      room: { type: 'string', max: 50 },
      capacity: { type: 'number', integer: true, min: 1, max: 10000 },
      schedule: { type: 'string', max: 200 },
      status: statusField(['active', 'inactive', 'archived']),
    },
  },

  enrollments: {
    table: 'enrollments',
    select:
      'id, institution_id, class_id, student_id, status, enrolled_at, created_at, updated_at, ' +
      'student:students!student_id ( id, admission_number, first_name, last_name ), ' +
      'class:classes!class_id ( id, name, section )',
    searchable: [],
    filters: ['status', 'class_id', 'student_id'],
    fields: {
      class_id: { type: 'uuid', required: true },
      student_id: { type: 'uuid', required: true },
      status: statusField(['enrolled', 'dropped', 'completed'], 'enrolled'),
    },
  },
};

module.exports = { RESOURCES };
