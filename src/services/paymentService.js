const ApiError = require('../utils/ApiError');
const { createUserClient } = require('../config/supabase');
const { normalizeFields, sanitizeSearch, parseListParams } = require('./resourceService');
const { PAYMENTS } = require('../config/fees');
const { toNumber, round2, attachFinanceStudents } = require('./feeService');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const sameUtcDay = (a, b) =>
  new Date(a).toISOString().slice(0, 10) === new Date(b).toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// List payments with optional paid_at range + student/method/reference filters.
// ---------------------------------------------------------------------------
const listPayments = async ({ accessToken, query = {} }) => {
  const supabase = createUserClient(accessToken);
  const { page, limit } = parseListParams(query);

  let builder = supabase.from(PAYMENTS.table).select(PAYMENTS.select, { count: 'exact' });

  for (const filter of PAYMENTS.filters) {
    const value = query[filter];
    if (value !== undefined && value !== '') builder = builder.eq(filter, value);
  }
  if (query.from) builder = builder.gte('paid_at', `${query.from}T00:00:00.000Z`);
  if (query.to) builder = builder.lte('paid_at', `${query.to}T23:59:59.999Z`);

  const term = sanitizeSearch(query.search);
  if (term) {
    const orFilter = PAYMENTS.searchable.map((column) => `${column}.ilike.%${term}%`).join(',');
    builder = builder.or(orFilter);
  }

  const { data, error, count } = await builder
    .order('paid_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (error) throw error;

  return {
    items: await attachFinanceStudents(supabase, data || []),
    total: count || 0,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil((count || 0) / limit)),
  };
};

const paymentDetail = async ({ accessToken, id }) => {
  const supabase = createUserClient(accessToken);
  const { data, error } = await supabase
    .from(PAYMENTS.table)
    .select(PAYMENTS.select)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new ApiError(404, 'Payment not found');
  return attachFinanceStudents(supabase, data);
};

// Guards against accidental double-entry: the same amount/method for a fee, on
// the same day when no reference is given, or the same reference otherwise.
const assertNotDuplicate = async (supabase, { studentId, studentFeeId, amount, method, reference, paidAt }) => {
  let builder = supabase.from(PAYMENTS.table).select('id, amount, method, reference, paid_at');
  builder = studentFeeId
    ? builder.eq('student_fee_id', studentFeeId)
    : builder.eq('student_id', studentId);

  const { data, error } = await builder;
  if (error) throw error;

  const duplicate = (data || []).find((payment) => {
    if (toNumber(payment.amount) !== amount || payment.method !== method) return false;
    if (reference) return (payment.reference || '') === reference;
    return sameUtcDay(payment.paid_at, paidAt);
  });

  if (duplicate) {
    throw new ApiError(422, 'Validation failed', [
      {
        field: 'amount',
        message: 'An identical payment was already recorded for this fee',
      },
    ]);
  }
};

const recordPayment = async ({ accessToken, payload, actorId }) => {
  const supabase = createUserClient(accessToken);
  const row = normalizeFields(PAYMENTS, payload, { partial: false });
  const amount = toNumber(row.amount);
  const paidAt = row.paid_at || new Date().toISOString();

  if (row.student_fee_id) {
    const { data: fee, error } = await supabase
      .from('student_fees')
      .select('id, student_id, amount_due, discount, amount_paid, outstanding, status')
      .eq('id', row.student_fee_id)
      .maybeSingle();

    if (error) throw error;
    if (!fee) throw new ApiError(404, 'Fee assignment not found');
    if (fee.student_id !== row.student_id) {
      throw new ApiError(422, 'Validation failed', [
        { field: 'student_fee_id', message: 'Fee assignment belongs to a different student' },
      ]);
    }
    if (['waived', 'cancelled'].includes(fee.status)) {
      throw new ApiError(422, 'Validation failed', [
        { field: 'student_fee_id', message: `This fee assignment is ${fee.status}` },
      ]);
    }

    const outstanding = toNumber(fee.outstanding);
    if (outstanding <= 0) {
      throw new ApiError(422, 'Validation failed', [
        { field: 'amount', message: 'This fee assignment is already fully settled' },
      ]);
    }
    if (amount > outstanding) {
      throw new ApiError(422, 'Validation failed', [
        { field: 'amount', message: `Payment exceeds the outstanding balance of ${round2(outstanding)}` },
      ]);
    }
  }

  await assertNotDuplicate(supabase, {
    studentId: row.student_id,
    studentFeeId: row.student_fee_id,
    amount,
    method: row.method,
    reference: row.reference,
    paidAt,
  });

  const { data, error } = await supabase
    .from(PAYMENTS.table)
    .insert({ ...row, paid_at: paidAt, recorded_by: actorId || null })
    .select(PAYMENTS.select)
    .single();

  if (error) throw error;
  return attachFinanceStudents(supabase, data);
};

// ---------------------------------------------------------------------------
// Receipt payload for print/download.
// ---------------------------------------------------------------------------
const receipt = async ({ accessToken, id }) => {
  const supabase = createUserClient(accessToken);
  const payment = await paymentDetail({ accessToken, id });

  let institution = null;
  if (payment.institution_id) {
    const { data } = await supabase
      .from('institutions')
      .select('id, name')
      .eq('id', payment.institution_id)
      .maybeSingle();
    institution = data || null;
  }

  return {
    receipt_number: payment.receipt_number,
    issued_at: payment.created_at,
    institution,
    student: payment.student,
    payment: {
      id: payment.id,
      amount: toNumber(payment.amount),
      method: payment.method,
      reference: payment.reference,
      paid_at: payment.paid_at,
      notes: payment.notes,
    },
    student_fee: payment.student_fee
      ? {
          id: payment.student_fee.id,
          amount_due: toNumber(payment.student_fee.amount_due),
          discount: toNumber(payment.student_fee.discount),
          amount_paid: toNumber(payment.student_fee.amount_paid),
          outstanding: toNumber(payment.student_fee.outstanding),
          status: payment.student_fee.status,
        }
      : null,
  };
};

module.exports = {
  listPayments,
  paymentDetail,
  recordPayment,
  receipt,
  UUID_RE,
};
