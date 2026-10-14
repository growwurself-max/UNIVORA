const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const payrollService = require('../services/payrollService');
const auditService = require('../services/auditService');

const audit = (req, action, entityType, entityId, { oldValue, newValue, metadata } = {}) =>
  auditService.logAction({
    actorId: req.user.id,
    action,
    entityType,
    entityId,
    oldValue,
    newValue,
    metadata,
    ip: req.ip,
  });

// ---------------------------------------------------------------------------
// Salary structures
// ---------------------------------------------------------------------------
const listStructures = asyncHandler(async (req, res) => {
  const result = await payrollService.listSalaryStructures({ accessToken: req.accessToken, query: req.query });
  res.status(200).json(new ApiResponse(200, 'Salary structures retrieved', result));
});

const createStructure = asyncHandler(async (req, res) => {
  const record = await payrollService.createSalaryStructure({ accessToken: req.accessToken, payload: req.body });
  await audit(req, 'salary_structure.create', 'salary_structures', record.id, { newValue: record });
  res.status(201).json(new ApiResponse(201, 'Salary structure created', record));
});

const updateStructure = asyncHandler(async (req, res) => {
  const { before, after, changes } = await payrollService.updateSalaryStructure({
    accessToken: req.accessToken,
    id: req.params.id,
    payload: req.body,
  });
  if (Object.keys(changes).length > 0) {
    await audit(req, 'salary_structure.update', 'salary_structures', after.id, {
      oldValue: before,
      newValue: after,
    });
  }
  res.status(200).json(new ApiResponse(200, 'Salary structure updated', after));
});

const removeStructure = asyncHandler(async (req, res) => {
  const record = await payrollService.removeSalaryStructure({ accessToken: req.accessToken, id: req.params.id });
  await audit(req, 'salary_structure.delete', 'salary_structures', record.id, { oldValue: record });
  res.status(200).json(new ApiResponse(200, 'Salary structure deleted', { id: record.id }));
});

// ---------------------------------------------------------------------------
// Payroll runs
// ---------------------------------------------------------------------------
const listRuns = asyncHandler(async (req, res) => {
  const result = await payrollService.listRuns({ accessToken: req.accessToken, query: req.query });
  res.status(200).json(new ApiResponse(200, 'Payroll runs retrieved', result));
});

const createRun = asyncHandler(async (req, res) => {
  const record = await payrollService.createRun({
    accessToken: req.accessToken,
    payload: req.body,
    actorId: req.user.id,
  });
  await audit(req, 'payroll_run.create', 'payroll_runs', record.id, { newValue: record });
  res.status(201).json(new ApiResponse(201, 'Payroll run created', record));
});

const runDetail = asyncHandler(async (req, res) => {
  const result = await payrollService.runDetail({ accessToken: req.accessToken, id: req.params.id });
  res.status(200).json(new ApiResponse(200, 'Payroll run retrieved', result));
});

const updateRun = asyncHandler(async (req, res) => {
  const { before, after, changes } = await payrollService.updateRun({
    accessToken: req.accessToken,
    id: req.params.id,
    payload: req.body,
  });
  if (Object.keys(changes).length > 0) {
    await audit(req, 'payroll_run.update', 'payroll_runs', after.id, { oldValue: before, newValue: after });
  }
  res.status(200).json(new ApiResponse(200, 'Payroll run updated', after));
});

const removeRun = asyncHandler(async (req, res) => {
  const record = await payrollService.removeRun({ accessToken: req.accessToken, id: req.params.id });
  await audit(req, 'payroll_run.delete', 'payroll_runs', record.id, { oldValue: record });
  res.status(200).json(new ApiResponse(200, 'Payroll run deleted', { id: record.id }));
});

const generateRun = asyncHandler(async (req, res) => {
  const result = await payrollService.generateRun({ accessToken: req.accessToken, id: req.params.id });
  await audit(req, 'payroll_run.generate', 'payroll_runs', req.params.id, {
    metadata: { created: result.created },
  });
  res.status(200).json(new ApiResponse(200, 'Payroll records generated', result));
});

// ---------------------------------------------------------------------------
// Payroll records
// ---------------------------------------------------------------------------
const updateRecord = asyncHandler(async (req, res) => {
  const { before, after, changes } = await payrollService.updateRecord({
    accessToken: req.accessToken,
    id: req.params.id,
    payload: req.body,
  });
  if (Object.keys(changes).length > 0) {
    await audit(req, 'payroll_record.update', 'payroll_records', after.id, {
      oldValue: before,
      newValue: after,
    });
  }
  res.status(200).json(new ApiResponse(200, 'Payroll record updated', after));
});

const removeRecord = asyncHandler(async (req, res) => {
  const record = await payrollService.removeRecord({ accessToken: req.accessToken, id: req.params.id });
  await audit(req, 'payroll_record.delete', 'payroll_records', record.id, { oldValue: record });
  res.status(200).json(new ApiResponse(200, 'Payroll record deleted', { id: record.id }));
});

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------
const monthlyReport = asyncHandler(async (req, res) => {
  const result = await payrollService.monthlyPayrollReport({ accessToken: req.accessToken, query: req.query });
  res.status(200).json(new ApiResponse(200, 'Payroll report retrieved', result));
});

module.exports = {
  listStructures,
  createStructure,
  updateStructure,
  removeStructure,
  listRuns,
  createRun,
  runDetail,
  updateRun,
  removeRun,
  generateRun,
  updateRecord,
  removeRecord,
  monthlyReport,
};
