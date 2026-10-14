const ApiError = require('../utils/ApiError');
const { createUserClient } = require('../config/supabase');
const { normalizeFields, sanitizeSearch, parseListParams } = require('./resourceService');
const {
  SALARY_STRUCTURES,
  SALARY_COMPONENTS,
  PAYROLL_RUNS,
  PAYROLL_RECORDS,
  MONTHS,
} = require('../config/fees');
const { round2, toNumber } = require('./feeService');

// ---------------------------------------------------------------------------
// Shared RLS-scoped helpers.
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

// ---------------------------------------------------------------------------
// Salary structures (+ components)
// ---------------------------------------------------------------------------
const normalizeComponents = (components) => {
  if (components === undefined) return null;
  if (!Array.isArray(components)) {
    throw new ApiError(422, 'Validation failed', [
      { field: 'components', message: 'components must be an array' },
    ]);
  }

  const errors = [];
  const rows = [];

  components.forEach((component, index) => {
    try {
      rows.push(normalizeFields(SALARY_COMPONENTS, component, { partial: false }));
    } catch (error) {
      (error.errors || []).forEach((item) =>
        errors.push({ field: `components[${index}].${item.field}`, message: item.message })
      );
    }
  });

  if (errors.length) throw new ApiError(422, 'Validation failed', errors);
  return rows;
};

const loadComponentsByStructure = async (supabase, structureIds) => {
  const grouped = {};
  if (!structureIds.length) return grouped;

  const { data, error } = await supabase
    .from(SALARY_COMPONENTS.table)
    .select(SALARY_COMPONENTS.select)
    .in('salary_structure_id', structureIds)
    .order('created_at', { ascending: true });

  if (error) throw error;

  (data || []).forEach((component) => {
    if (!grouped[component.salary_structure_id]) grouped[component.salary_structure_id] = [];
    grouped[component.salary_structure_id].push(component);
  });

  return grouped;
};

const listSalaryStructures = async ({ accessToken, query }) => {
  const supabase = createUserClient(accessToken);
  const result = await listResource(supabase, SALARY_STRUCTURES, query);
  const grouped = await loadComponentsByStructure(
    supabase,
    result.items.map((structure) => structure.id)
  );

  return {
    ...result,
    items: result.items.map((structure) => ({
      ...structure,
      components: grouped[structure.id] || [],
    })),
  };
};

const createSalaryStructure = async ({ accessToken, payload }) => {
  const supabase = createUserClient(accessToken);
  const row = normalizeFields(SALARY_STRUCTURES, payload, { partial: false });
  const components = normalizeComponents(payload.components);

  const { data: structure, error } = await supabase
    .from(SALARY_STRUCTURES.table)
    .insert(row)
    .select(SALARY_STRUCTURES.select)
    .single();
  if (error) throw error;

  let insertedComponents = [];
  if (components && components.length) {
    const { data, error: componentError } = await supabase
      .from(SALARY_COMPONENTS.table)
      .insert(components.map((component) => ({ ...component, salary_structure_id: structure.id })))
      .select(SALARY_COMPONENTS.select);
    if (componentError) throw componentError;
    insertedComponents = data || [];
  }

  return { ...structure, components: insertedComponents };
};

const updateSalaryStructure = async ({ accessToken, id, payload }) => {
  const supabase = createUserClient(accessToken);
  const before = await resourceDetail(supabase, SALARY_STRUCTURES, id, 'Salary structure not found');
  const changes = normalizeFields(SALARY_STRUCTURES, payload, { partial: true });
  const components = normalizeComponents(payload.components);

  let after = before;
  if (Object.keys(changes).length > 0) {
    const { data, error } = await supabase
      .from(SALARY_STRUCTURES.table)
      .update(changes)
      .eq('id', id)
      .select(SALARY_STRUCTURES.select)
      .single();
    if (error) throw error;
    after = data;
  }

  let afterComponents;
  if (components !== null) {
    const { error: deleteError } = await supabase
      .from(SALARY_COMPONENTS.table)
      .delete()
      .eq('salary_structure_id', id);
    if (deleteError) throw deleteError;

    if (components.length) {
      const { data, error: insertError } = await supabase
        .from(SALARY_COMPONENTS.table)
        .insert(components.map((component) => ({ ...component, salary_structure_id: id })))
        .select(SALARY_COMPONENTS.select);
      if (insertError) throw insertError;
      afterComponents = data || [];
    } else {
      afterComponents = [];
    }
  } else {
    afterComponents = (await loadComponentsByStructure(supabase, [id]))[id] || [];
  }

  return { before, after: { ...after, components: afterComponents }, changes };
};

const removeSalaryStructure = async ({ accessToken, id }) => {
  const supabase = createUserClient(accessToken);
  const before = await resourceDetail(supabase, SALARY_STRUCTURES, id, 'Salary structure not found');
  const { error } = await supabase.from(SALARY_STRUCTURES.table).delete().eq('id', id);
  if (error) throw error;
  return before;
};

// ---------------------------------------------------------------------------
// Payroll runs
// ---------------------------------------------------------------------------
const runName = (month, year) => `${MONTHS[month - 1] || month} ${year} payroll`;

const listRuns = async ({ accessToken, query }) => {
  const supabase = createUserClient(accessToken);
  return listResource(supabase, PAYROLL_RUNS, query);
};

const createRun = async ({ accessToken, payload, actorId }) => {
  const supabase = createUserClient(accessToken);
  const row = normalizeFields(PAYROLL_RUNS, payload, { partial: false });
  if (!row.name) row.name = runName(row.period_month, row.period_year);

  const { data, error } = await supabase
    .from(PAYROLL_RUNS.table)
    .insert({ ...row, processed_by: actorId || null })
    .select(PAYROLL_RUNS.select)
    .single();

  if (error) throw error;
  return data;
};

const updateRun = async ({ accessToken, id, payload }) => {
  const supabase = createUserClient(accessToken);
  const before = await resourceDetail(supabase, PAYROLL_RUNS, id, 'Payroll run not found');
  const changes = normalizeFields(PAYROLL_RUNS, payload, { partial: true });

  if (Object.keys(changes).length === 0) return { before, after: before, changes };

  const { data: after, error } = await supabase
    .from(PAYROLL_RUNS.table)
    .update(changes)
    .eq('id', id)
    .select(PAYROLL_RUNS.select)
    .single();

  if (error) throw error;
  return { before, after, changes };
};

const removeRun = async ({ accessToken, id }) => {
  const supabase = createUserClient(accessToken);
  const before = await resourceDetail(supabase, PAYROLL_RUNS, id, 'Payroll run not found');
  const { error } = await supabase.from(PAYROLL_RUNS.table).delete().eq('id', id);
  if (error) throw error;
  return before;
};

const runDetail = async ({ accessToken, id }) => {
  const supabase = createUserClient(accessToken);
  const run = await resourceDetail(supabase, PAYROLL_RUNS, id, 'Payroll run not found');

  const { data, error } = await supabase
    .from(PAYROLL_RECORDS.table)
    .select(PAYROLL_RECORDS.select)
    .eq('payroll_run_id', id)
    .order('created_at', { ascending: true });
  if (error) throw error;

  return { run, records: data || [] };
};

const componentValue = (component, baseSalary) =>
  component.is_percentage ? (baseSalary * toNumber(component.amount)) / 100 : toNumber(component.amount);

// Creates a payslip record for every active salary structure not already in the
// run. Allowances/deductions are derived from each structure's components.
const generateRun = async ({ accessToken, id }) => {
  const supabase = createUserClient(accessToken);
  const run = await resourceDetail(supabase, PAYROLL_RUNS, id, 'Payroll run not found');

  if (['paid', 'cancelled'].includes(run.status)) {
    throw new ApiError(422, 'Validation failed', [
      { field: 'status', message: `Cannot generate records for a ${run.status} payroll run` },
    ]);
  }

  const { data: structures, error: structureError } = await supabase
    .from(SALARY_STRUCTURES.table)
    .select(SALARY_STRUCTURES.select)
    .eq('status', 'active');
  if (structureError) throw structureError;

  const structureList = structures || [];
  const grouped = await loadComponentsByStructure(
    supabase,
    structureList.map((structure) => structure.id)
  );

  const { data: existing, error: existingError } = await supabase
    .from(PAYROLL_RECORDS.table)
    .select('faculty_id, profile_id')
    .eq('payroll_run_id', id);
  if (existingError) throw existingError;

  const existingKeys = new Set(
    (existing || []).map((record) => record.faculty_id || record.profile_id || record.id)
  );

  const rows = [];
  structureList.forEach((structure) => {
    const key = structure.faculty_id || structure.profile_id;
    if (key && existingKeys.has(key)) return;

    const base = toNumber(structure.base_salary);
    let allowances = 0;
    let deductions = 0;

    (grouped[structure.id] || []).forEach((component) => {
      const value = componentValue(component, base);
      if (component.type === 'allowance') allowances += value;
      else deductions += value;
    });

    rows.push({
      payroll_run_id: id,
      faculty_id: structure.faculty_id || null,
      profile_id: structure.profile_id || null,
      base_salary: round2(base),
      allowances: round2(allowances),
      deductions: round2(deductions),
      status: 'pending',
    });
  });

  if (rows.length === 0) {
    return { run, created: 0, records: [] };
  }

  const { data, error } = await supabase
    .from(PAYROLL_RECORDS.table)
    .insert(rows)
    .select(PAYROLL_RECORDS.select);
  if (error) throw error;

  return { run, created: (data || []).length, records: data || [] };
};

// ---------------------------------------------------------------------------
// Payroll records
// ---------------------------------------------------------------------------
const updateRecord = async ({ accessToken, id, payload }) => {
  const supabase = createUserClient(accessToken);
  const before = await resourceDetail(supabase, PAYROLL_RECORDS, id, 'Payroll record not found');
  const changes = normalizeFields(PAYROLL_RECORDS, payload, { partial: true });

  if (changes.status === 'paid' && !changes.paid_at) changes.paid_at = new Date().toISOString();
  if (changes.status && changes.status !== 'paid') changes.paid_at = null;

  if (Object.keys(changes).length === 0) return { before, after: before, changes };

  const { data: after, error } = await supabase
    .from(PAYROLL_RECORDS.table)
    .update(changes)
    .eq('id', id)
    .select(PAYROLL_RECORDS.select)
    .single();

  if (error) throw error;
  return { before, after, changes };
};

const removeRecord = async ({ accessToken, id }) => {
  const supabase = createUserClient(accessToken);
  const before = await resourceDetail(supabase, PAYROLL_RECORDS, id, 'Payroll record not found');
  const { error } = await supabase.from(PAYROLL_RECORDS.table).delete().eq('id', id);
  if (error) throw error;
  return before;
};

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------
const monthlyPayrollReport = async ({ accessToken, query = {} }) => {
  const supabase = createUserClient(accessToken);

  let builder = supabase.from(PAYROLL_RUNS.table).select(PAYROLL_RUNS.select);
  if (query.period_year) builder = builder.eq('period_year', query.period_year);
  if (query.period_month) builder = builder.eq('period_month', query.period_month);
  if (query.status) builder = builder.eq('status', query.status);

  const { data: runs, error } = await builder
    .order('period_year', { ascending: false })
    .order('period_month', { ascending: false });
  if (error) throw error;

  const runList = runs || [];
  let records = [];
  if (runList.length) {
    const { data, error: recordError } = await supabase
      .from(PAYROLL_RECORDS.table)
      .select(PAYROLL_RECORDS.select)
      .in('payroll_run_id', runList.map((run) => run.id));
    if (recordError) throw recordError;
    records = data || [];
  }

  const byRun = new Map();
  records.forEach((record) => {
    if (!byRun.has(record.payroll_run_id)) byRun.set(record.payroll_run_id, []);
    byRun.get(record.payroll_run_id).push(record);
  });

  const months = runList.map((run) => {
    const runRecords = byRun.get(run.id) || [];
    return {
      run,
      records: runRecords,
      totals: {
        gross: round2(toNumber(run.total_gross)),
        deductions: round2(toNumber(run.total_deductions)),
        net: round2(toNumber(run.total_net)),
        paid: round2(
          runRecords
            .filter((record) => record.status === 'paid')
            .reduce((sum, record) => sum + toNumber(record.net_salary), 0)
        ),
        pending: round2(
          runRecords
            .filter((record) => record.status === 'pending')
            .reduce((sum, record) => sum + toNumber(record.net_salary), 0)
        ),
        headcount: runRecords.length,
      },
    };
  });

  const totals = months.reduce(
    (acc, month) => ({
      gross: round2(acc.gross + month.totals.gross),
      deductions: round2(acc.deductions + month.totals.deductions),
      net: round2(acc.net + month.totals.net),
      paid: round2(acc.paid + month.totals.paid),
      pending: round2(acc.pending + month.totals.pending),
      headcount: acc.headcount + month.totals.headcount,
    }),
    { gross: 0, deductions: 0, net: 0, paid: 0, pending: 0, headcount: 0 }
  );

  return { filters: { period_year: query.period_year || null, period_month: query.period_month || null }, months, totals };
};

module.exports = {
  listSalaryStructures,
  createSalaryStructure,
  updateSalaryStructure,
  removeSalaryStructure,
  listRuns,
  createRun,
  updateRun,
  removeRun,
  runDetail,
  generateRun,
  updateRecord,
  removeRecord,
  monthlyPayrollReport,
};
