// Declarative field/select definitions for the Phase 5 fees, payments & payroll
// resources. Consumed by the shared `normalizeFields` validator (via a minimal
// `{ fields }` resource shape) and by the dedicated fee/payment/payroll services.

const FEE_TYPES = {
  table: 'fee_types',
  select: 'id, institution_id, name, code, description, status, created_at, updated_at',
  searchable: ['name', 'code'],
  filters: ['status'],
  fields: {
    name: { type: 'string', required: true, max: 100 },
    code: { type: 'string', max: 30, uppercase: true },
    description: { type: 'string', max: 1000 },
    status: { type: 'enum', values: ['active', 'inactive'], default: 'active' },
  },
};

const FEE_STRUCTURES = {
  table: 'fee_structures',
  select:
    'id, institution_id, fee_type_id, academic_year_id, class_id, term_id, name, amount, currency, frequency, due_date, status, description, created_at, updated_at, ' +
    'fee_type:fee_types!fee_type_id ( id, name, code ), ' +
    'academic_year:academic_years!academic_year_id ( id, name ), ' +
    'class:classes!class_id ( id, name, section ), ' +
    'term:terms!term_id ( id, name )',
  searchable: ['name', 'description'],
  filters: ['status', 'fee_type_id', 'academic_year_id', 'class_id', 'term_id', 'frequency'],
  fields: {
    fee_type_id: { type: 'uuid', required: true },
    academic_year_id: { type: 'uuid', required: true },
    class_id: { type: 'uuid', required: true },
    term_id: { type: 'uuid' },
    name: { type: 'string', required: true, max: 150 },
    amount: { type: 'number', required: true, min: 0.01, max: 100000000 },
    currency: { type: 'string', max: 10 },
    frequency: {
      type: 'enum',
      values: ['one_time', 'monthly', 'termly', 'annual'],
      default: 'one_time',
    },
    due_date: { type: 'date' },
    status: { type: 'enum', values: ['active', 'inactive'], default: 'active' },
    description: { type: 'string', max: 1000 },
  },
};

const STUDENT_FEES = {
  table: 'student_fees',
  select:
    'id, institution_id, student_id, fee_structure_id, academic_year_id, amount_due, discount, amount_paid, outstanding, due_date, status, notes, created_at, updated_at, ' +
    'student:students!student_id ( id, admission_number, first_name, last_name ), ' +
    'fee_structure:fee_structures!fee_structure_id ( id, name, amount, fee_type_id, class_id, academic_year_id, fee_type:fee_types!fee_type_id ( id, name ) )',
  searchable: ['notes'],
  filters: ['status', 'student_id', 'fee_structure_id', 'academic_year_id'],
  fields: {
    student_id: { type: 'uuid', required: true },
    fee_structure_id: { type: 'uuid', required: true },
    academic_year_id: { type: 'uuid', required: true },
    amount_due: { type: 'number', required: true, min: 0.01, max: 100000000 },
    discount: { type: 'number', min: 0, max: 100000000 },
    due_date: { type: 'date' },
    status: { type: 'enum', values: ['pending', 'partial', 'paid', 'waived', 'cancelled'] },
    notes: { type: 'string', max: 1000 },
  },
};

const PAYMENTS = {
  table: 'payments',
  select:
    'id, institution_id, student_id, student_fee_id, amount, method, reference, receipt_number, paid_at, notes, recorded_by, created_at, updated_at, ' +
    'student:students!student_id ( id, admission_number, first_name, last_name ), ' +
    'student_fee:student_fees!student_fee_id ( id, amount_due, discount, amount_paid, outstanding, status, fee_structure_id )',
  searchable: ['receipt_number', 'reference', 'notes'],
  filters: ['student_id', 'student_fee_id', 'method'],
  fields: {
    student_id: { type: 'uuid', required: true },
    student_fee_id: { type: 'uuid' },
    amount: { type: 'number', required: true, min: 0.01, max: 100000000 },
    method: {
      type: 'enum',
      values: ['cash', 'bank_transfer', 'card', 'cheque', 'online', 'other'],
      default: 'cash',
    },
    reference: { type: 'string', max: 100 },
    paid_at: { type: 'datetime' },
    notes: { type: 'string', max: 1000 },
  },
};

const SALARY_STRUCTURES = {
  table: 'salary_structures',
  select:
    'id, institution_id, faculty_id, profile_id, name, base_salary, currency, pay_frequency, effective_from, status, notes, created_at, updated_at, ' +
    'faculty:faculty!faculty_id ( id, employee_id, first_name, last_name ), ' +
    'staff:profiles!profile_id ( id, full_name, email )',
  searchable: ['name', 'notes'],
  filters: ['status', 'faculty_id', 'profile_id', 'pay_frequency'],
  fields: {
    faculty_id: { type: 'uuid' },
    profile_id: { type: 'uuid' },
    name: { type: 'string', required: true, max: 150 },
    base_salary: { type: 'number', required: true, min: 0.01, max: 100000000 },
    currency: { type: 'string', max: 10 },
    pay_frequency: { type: 'enum', values: ['monthly', 'biweekly', 'weekly'], default: 'monthly' },
    effective_from: { type: 'date' },
    status: { type: 'enum', values: ['active', 'inactive'], default: 'active' },
    notes: { type: 'string', max: 1000 },
  },
};

const SALARY_COMPONENTS = {
  table: 'salary_components',
  select: 'id, institution_id, salary_structure_id, name, type, amount, is_percentage, created_at, updated_at',
  filters: ['salary_structure_id', 'type'],
  fields: {
    name: { type: 'string', required: true, max: 100 },
    type: { type: 'enum', values: ['allowance', 'deduction'], required: true },
    amount: { type: 'number', required: true, min: 0, max: 100000000 },
    is_percentage: { type: 'boolean', default: false },
  },
};

const PAYROLL_RUNS = {
  table: 'payroll_runs',
  select:
    'id, institution_id, period_month, period_year, name, status, total_gross, total_deductions, total_net, notes, processed_by, created_at, updated_at',
  searchable: ['name', 'notes'],
  filters: ['status', 'period_year', 'period_month'],
  fields: {
    period_month: { type: 'number', required: true, integer: true, min: 1, max: 12 },
    period_year: { type: 'number', required: true, integer: true, min: 2000, max: 2100 },
    name: { type: 'string', max: 150 },
    status: {
      type: 'enum',
      values: ['draft', 'processing', 'approved', 'paid', 'cancelled'],
      default: 'draft',
    },
    notes: { type: 'string', max: 1000 },
  },
};

const PAYROLL_RECORDS = {
  table: 'payroll_records',
  select:
    'id, institution_id, payroll_run_id, faculty_id, profile_id, base_salary, allowances, deductions, net_salary, status, paid_at, notes, created_at, updated_at, ' +
    'faculty:faculty!faculty_id ( id, employee_id, first_name, last_name ), ' +
    'staff:profiles!profile_id ( id, full_name, email )',
  searchable: ['notes'],
  filters: ['payroll_run_id', 'status', 'faculty_id', 'profile_id'],
  fields: {
    payroll_run_id: { type: 'uuid', required: true },
    faculty_id: { type: 'uuid' },
    profile_id: { type: 'uuid' },
    base_salary: { type: 'number', required: true, min: 0, max: 100000000 },
    allowances: { type: 'number', min: 0, max: 100000000 },
    deductions: { type: 'number', min: 0, max: 100000000 },
    status: { type: 'enum', values: ['pending', 'paid', 'cancelled'], default: 'pending' },
    paid_at: { type: 'datetime' },
    notes: { type: 'string', max: 1000 },
  },
};

const PAYMENT_METHODS = ['cash', 'bank_transfer', 'card', 'cheque', 'online', 'other'];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

module.exports = {
  FEE_TYPES,
  FEE_STRUCTURES,
  STUDENT_FEES,
  PAYMENTS,
  SALARY_STRUCTURES,
  SALARY_COMPONENTS,
  PAYROLL_RUNS,
  PAYROLL_RECORDS,
  PAYMENT_METHODS,
  MONTHS,
};
