const ApiError = require('../utils/ApiError');
const { createUserClient } = require('../config/supabase');
const { normalizeFields, sanitizeSearch, parseListParams } = require('./resourceService');
const {
  FEE_TYPES,
  FEE_STRUCTURES,
  STUDENT_FEES,
} = require('../config/fees');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

const round2 = (value) => Math.round(Number(value) * 100) / 100;
const toNumber = (value) => (value === null || value === undefined ? 0 : Number(value));

const assertUuid = (value, field) => {
  if (!UUID_RE.test(String(value || ''))) {
    throw new ApiError(422, 'Validation failed', [
      { field, message: `${field} must be a valid id` },
    ]);
  }
};

const todayIso = () => new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Shared RLS-scoped helpers (mirror the exam service).
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
// Fee types
// ---------------------------------------------------------------------------
const listFeeTypes = async ({ accessToken, query }) => {
  const supabase = createUserClient(accessToken);
  return listResource(supabase, FEE_TYPES, query);
};

const createFeeType = async ({ accessToken, payload }) => {
  const supabase = createUserClient(accessToken);
  const row = normalizeFields(FEE_TYPES, payload, { partial: false });

  const { data, error } = await supabase
    .from(FEE_TYPES.table)
    .insert(row)
    .select(FEE_TYPES.select)
    .single();

  if (error) throw error;
  return data;
};

const updateFeeType = async ({ accessToken, id, payload }) => {
  const supabase = createUserClient(accessToken);
  const before = await resourceDetail(supabase, FEE_TYPES, id, 'Fee type not found');
  const changes = normalizeFields(FEE_TYPES, payload, { partial: true });

  if (Object.keys(changes).length === 0) return { before, after: before, changes };

  const { data: after, error } = await supabase
    .from(FEE_TYPES.table)
    .update(changes)
    .eq('id', id)
    .select(FEE_TYPES.select)
    .single();

  if (error) throw error;
  return { before, after, changes };
};

const removeFeeType = async ({ accessToken, id }) => {
  const supabase = createUserClient(accessToken);
  return removeResource(supabase, FEE_TYPES, id, 'Fee type not found');
};

// ---------------------------------------------------------------------------
// Fee structures
// ---------------------------------------------------------------------------
const listFeeStructures = async ({ accessToken, query }) => {
  const supabase = createUserClient(accessToken);
  return listResource(supabase, FEE_STRUCTURES, query);
};

const createFeeStructure = async ({ accessToken, payload }) => {
  const supabase = createUserClient(accessToken);
  const row = normalizeFields(FEE_STRUCTURES, payload, { partial: false });

  const { data, error } = await supabase
    .from(FEE_STRUCTURES.table)
    .insert(row)
    .select(FEE_STRUCTURES.select)
    .single();

  if (error) throw error;
  return data;
};

const updateFeeStructure = async ({ accessToken, id, payload }) => {
  const supabase = createUserClient(accessToken);
  const before = await resourceDetail(supabase, FEE_STRUCTURES, id, 'Fee structure not found');
  const changes = normalizeFields(FEE_STRUCTURES, payload, { partial: true });

  if (Object.keys(changes).length === 0) return { before, after: before, changes };

  const { data: after, error } = await supabase
    .from(FEE_STRUCTURES.table)
    .update(changes)
    .eq('id', id)
    .select(FEE_STRUCTURES.select)
    .single();

  if (error) throw error;
  return { before, after, changes };
};

const removeFeeStructure = async ({ accessToken, id }) => {
  const supabase = createUserClient(accessToken);
  return removeResource(supabase, FEE_STRUCTURES, id, 'Fee structure not found');
};

// ---------------------------------------------------------------------------
// Student fee assignments
// ---------------------------------------------------------------------------
const listAssignments = async ({ accessToken, query }) => {
  const supabase = createUserClient(accessToken);
  return listResource(supabase, STUDENT_FEES, query);
};

const assignmentDetail = async ({ accessToken, id }) => {
  const supabase = createUserClient(accessToken);
  return resourceDetail(supabase, STUDENT_FEES, id, 'Fee assignment not found');
};

// Fills in amount/year/due-date defaults from the referenced fee structure so a
// single assignment only needs student_id + fee_structure_id.
const withStructureDefaults = async (supabase, payload) => {
  if (!payload || payload.amount_due !== undefined) return payload;

  assertUuid(payload.fee_structure_id, 'fee_structure_id');
  const structure = await resourceDetail(
    supabase,
    FEE_STRUCTURES,
    payload.fee_structure_id,
    'Fee structure not found'
  );

  return {
    ...payload,
    amount_due: structure.amount,
    academic_year_id: payload.academic_year_id || structure.academic_year_id,
    due_date: payload.due_date !== undefined ? payload.due_date : structure.due_date,
  };
};

const createAssignment = async ({ accessToken, payload }) => {
  const supabase = createUserClient(accessToken);
  const enriched = await withStructureDefaults(supabase, payload);
  const row = normalizeFields(STUDENT_FEES, enriched, { partial: false });

  const { data, error } = await supabase
    .from(STUDENT_FEES.table)
    .insert(row)
    .select(STUDENT_FEES.select)
    .single();

  if (error) throw error;
  return data;
};

const updateAssignment = async ({ accessToken, id, payload }) => {
  const supabase = createUserClient(accessToken);
  const before = await resourceDetail(supabase, STUDENT_FEES, id, 'Fee assignment not found');
  const changes = normalizeFields(STUDENT_FEES, payload, { partial: true });

  if (Object.keys(changes).length === 0) return { before, after: before, changes };

  const { data: after, error } = await supabase
    .from(STUDENT_FEES.table)
    .update(changes)
    .eq('id', id)
    .select(STUDENT_FEES.select)
    .single();

  if (error) throw error;
  return { before, after, changes };
};

const removeAssignment = async ({ accessToken, id }) => {
  const supabase = createUserClient(accessToken);
  return removeResource(supabase, STUDENT_FEES, id, 'Fee assignment not found');
};

// Assigns one fee structure to many students. When no student_ids are supplied,
// every currently-enrolled student in the structure's class is assigned.
const bulkAssign = async ({ accessToken, payload }) => {
  const supabase = createUserClient(accessToken);
  const body = payload || {};

  assertUuid(body.fee_structure_id, 'fee_structure_id');
  const structure = await resourceDetail(
    supabase,
    FEE_STRUCTURES,
    body.fee_structure_id,
    'Fee structure not found'
  );

  let studentIds = Array.isArray(body.student_ids) ? body.student_ids : [];

  if (studentIds.length === 0) {
    const { data, error } = await supabase
      .from('enrollments')
      .select('student_id, status')
      .eq('class_id', structure.class_id);
    if (error) throw error;
    studentIds = (data || []).filter((row) => row.status === 'enrolled').map((row) => row.student_id);
  }

  studentIds = Array.from(new Set(studentIds.map((id) => String(id).trim())));
  if (studentIds.length === 0) {
    throw new ApiError(422, 'Validation failed', [
      { field: 'student_ids', message: 'No students to assign this fee to' },
    ]);
  }

  const errors = [];
  studentIds.forEach((id) => {
    if (!UUID_RE.test(id)) {
      errors.push({ field: 'student_ids', message: `Invalid student id: ${id}` });
    }
  });
  if (errors.length) throw new ApiError(422, 'Validation failed', errors);

  const discount = toNumber(body.discount);
  const dueDate = body.due_date !== undefined ? body.due_date : structure.due_date;
  const amountDue = body.amount_due !== undefined ? toNumber(body.amount_due) : toNumber(structure.amount);

  const rows = studentIds.map((studentId) => ({
    student_id: studentId,
    fee_structure_id: structure.id,
    academic_year_id: structure.academic_year_id,
    amount_due: amountDue,
    discount,
    due_date: dueDate || null,
    notes: body.notes ? String(body.notes).slice(0, 1000) : null,
  }));

  const { data, error } = await supabase
    .from(STUDENT_FEES.table)
    .upsert(rows, { onConflict: 'student_id,fee_structure_id', ignoreDuplicates: true })
    .select(STUDENT_FEES.select);

  if (error) throw error;
  return data || [];
};

// ---------------------------------------------------------------------------
// Fee dashboard: collected vs pending vs overdue.
// ---------------------------------------------------------------------------
const feeDashboard = async ({ accessToken, query = {} }) => {
  const supabase = createUserClient(accessToken);

  let paymentQuery = supabase
    .from('payments')
    .select('amount, paid_at, method')
    .order('paid_at', { ascending: false });

  if (query.from) paymentQuery = paymentQuery.gte('paid_at', `${query.from}T00:00:00.000Z`);
  if (query.to) paymentQuery = paymentQuery.lte('paid_at', `${query.to}T23:59:59.999Z`);

  const { data: payments, error: paymentError } = await paymentQuery;
  if (paymentError) throw paymentError;

  let feeQuery = supabase
    .from(STUDENT_FEES.table)
    .select('id, amount_due, discount, amount_paid, outstanding, due_date, status');
  if (query.academic_year_id) feeQuery = feeQuery.eq('academic_year_id', query.academic_year_id);

  const { data: fees, error: feeError } = await feeQuery;
  if (feeError) throw feeError;

  const today = todayIso();
  const totals = { collected: 0, pending: 0, overdue: 0, overdue_count: 0, billed: 0 };
  const methodTotals = {};

  (payments || []).forEach((payment) => {
    totals.collected += toNumber(payment.amount);
    const method = payment.method || 'other';
    methodTotals[method] = round2((methodTotals[method] || 0) + toNumber(payment.amount));
  });

  (fees || []).forEach((fee) => {
    const outstanding = toNumber(fee.outstanding);
    totals.billed += toNumber(fee.amount_due) - toNumber(fee.discount);
    if (['waived', 'cancelled'].includes(fee.status) || outstanding <= 0) return;
    totals.pending += outstanding;
    if (fee.due_date && String(fee.due_date).slice(0, 10) < today) {
      totals.overdue += outstanding;
      totals.overdue_count += 1;
    }
  });

  return {
    collected: round2(totals.collected),
    pending: round2(totals.pending),
    overdue: round2(totals.overdue),
    overdue_count: totals.overdue_count,
    billed: round2(totals.billed),
    payment_count: (payments || []).length,
    assignment_count: (fees || []).length,
    by_method: methodTotals,
    generated_at: new Date().toISOString(),
  };
};

// ---------------------------------------------------------------------------
// Student-wise payment history + outstanding dues.
// ---------------------------------------------------------------------------
const studentFeeHistory = async ({ accessToken, studentId }) => {
  assertUuid(studentId, 'student_id');
  const supabase = createUserClient(accessToken);

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('id, admission_number, first_name, last_name')
    .eq('id', studentId)
    .maybeSingle();

  if (studentError) throw studentError;
  if (!student) throw new ApiError(404, 'Student not found');

  const { data: fees, error: feeError } = await supabase
    .from(STUDENT_FEES.table)
    .select(STUDENT_FEES.select)
    .eq('student_id', studentId)
    .order('created_at', { ascending: true });
  if (feeError) throw feeError;

  const { data: payments, error: paymentError } = await supabase
    .from('payments')
    .select(
      'id, amount, method, reference, receipt_number, paid_at, notes, ' +
        'student_fee:student_fees!student_fee_id ( id, fee_structure_id )'
    )
    .eq('student_id', studentId)
    .order('paid_at', { ascending: false });
  if (paymentError) throw paymentError;

  const today = todayIso();
  const summary = { billed: 0, paid: 0, discount: 0, outstanding: 0, overdue: 0 };

  (fees || []).forEach((fee) => {
    const outstanding = toNumber(fee.outstanding);
    summary.billed += toNumber(fee.amount_due);
    summary.paid += toNumber(fee.amount_paid);
    summary.discount += toNumber(fee.discount);
    if (!['waived', 'cancelled'].includes(fee.status) && outstanding > 0) {
      summary.outstanding += outstanding;
      if (fee.due_date && String(fee.due_date).slice(0, 10) < today) summary.overdue += outstanding;
    }
  });

  Object.keys(summary).forEach((key) => {
    summary[key] = round2(summary[key]);
  });

  return {
    student,
    fees: fees || [],
    payments: payments || [],
    summary,
  };
};

// ---------------------------------------------------------------------------
// Reports: date-wise collection + outstanding dues.
// ---------------------------------------------------------------------------
const collectionsReport = async ({ accessToken, query = {} }) => {
  const supabase = createUserClient(accessToken);

  let builder = supabase
    .from('payments')
    .select(
      'id, amount, method, reference, receipt_number, paid_at, ' +
        'student:students!student_id ( id, admission_number, first_name, last_name ), ' +
        'student_fee:student_fees!student_fee_id ( id, fee_structure_id, ' +
        'fee_structure:fee_structures!fee_structure_id ( id, class_id, fee_type_id, ' +
        'fee_type:fee_types!fee_type_id ( id, name ) ) )'
    );

  if (query.from) builder = builder.gte('paid_at', `${query.from}T00:00:00.000Z`);
  if (query.to) builder = builder.lte('paid_at', `${query.to}T23:59:59.999Z`);
  if (query.method) builder = builder.eq('method', query.method);
  if (query.student_id) builder = builder.eq('student_id', query.student_id);

  const { data, error } = await builder.order('paid_at', { ascending: true });
  if (error) throw error;

  const payments = (data || []).filter((payment) => {
    const structure = payment.student_fee?.fee_structure;
    if (query.class_id && structure?.class_id !== query.class_id) return false;
    if (query.fee_type_id && structure?.fee_type_id !== query.fee_type_id) return false;
    return true;
  });

  const byDate = new Map();
  let total = 0;

  payments.forEach((payment) => {
    const date = String(payment.paid_at).slice(0, 10);
    const amount = toNumber(payment.amount);
    total += amount;
    if (!byDate.has(date)) byDate.set(date, { date, total: 0, count: 0 });
    const bucket = byDate.get(date);
    bucket.total = round2(bucket.total + amount);
    bucket.count += 1;
  });

  return {
    filters: {
      from: query.from || null,
      to: query.to || null,
      method: query.method || null,
      class_id: query.class_id || null,
      fee_type_id: query.fee_type_id || null,
    },
    days: Array.from(byDate.values()),
    total: round2(total),
    count: payments.length,
    payments,
  };
};

const outstandingReport = async ({ accessToken, query = {} }) => {
  const supabase = createUserClient(accessToken);
  const today = todayIso();

  let builder = supabase
    .from(STUDENT_FEES.table)
    .select(STUDENT_FEES.select)
    .order('due_date', { ascending: true, nullsFirst: false });

  if (query.academic_year_id) builder = builder.eq('academic_year_id', query.academic_year_id);
  if (query.status) builder = builder.eq('status', query.status);

  const { data, error } = await builder;
  if (error) throw error;

  const rows = (data || [])
    .filter((fee) => {
      if (query.class_id && fee.fee_structure?.class_id !== query.class_id) return false;
      if (query.overdue === 'true' || query.overdue === true) {
        return toNumber(fee.outstanding) > 0 && fee.due_date && String(fee.due_date).slice(0, 10) < today;
      }
      return toNumber(fee.outstanding) > 0;
    })
    .map((fee) => ({
      ...fee,
      is_overdue: Boolean(
        toNumber(fee.outstanding) > 0 && fee.due_date && String(fee.due_date).slice(0, 10) < today
      ),
    }));

  const total = rows.reduce((sum, fee) => sum + toNumber(fee.outstanding), 0);

  return {
    students: rows,
    total_outstanding: round2(total),
    count: rows.length,
    generated_at: new Date().toISOString(),
  };
};

module.exports = {
  listFeeTypes,
  createFeeType,
  updateFeeType,
  removeFeeType,
  listFeeStructures,
  createFeeStructure,
  updateFeeStructure,
  removeFeeStructure,
  listAssignments,
  assignmentDetail,
  createAssignment,
  updateAssignment,
  removeAssignment,
  bulkAssign,
  feeDashboard,
  studentFeeHistory,
  collectionsReport,
  outstandingReport,
  round2,
  toNumber,
  assertUuid,
  ZERO_UUID,
};
