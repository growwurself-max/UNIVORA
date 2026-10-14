const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const feeService = require('../services/feeService');
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
// Fee types
// ---------------------------------------------------------------------------
const listFeeTypes = asyncHandler(async (req, res) => {
  const result = await feeService.listFeeTypes({ accessToken: req.accessToken, query: req.query });
  res.status(200).json(new ApiResponse(200, 'Fee types retrieved', result));
});

const createFeeType = asyncHandler(async (req, res) => {
  const record = await feeService.createFeeType({ accessToken: req.accessToken, payload: req.body });
  await audit(req, 'fee_type.create', 'fee_types', record.id, { newValue: record });
  res.status(201).json(new ApiResponse(201, 'Fee type created', record));
});

const updateFeeType = asyncHandler(async (req, res) => {
  const { before, after, changes } = await feeService.updateFeeType({
    accessToken: req.accessToken,
    id: req.params.id,
    payload: req.body,
  });
  if (Object.keys(changes).length > 0) {
    await audit(req, 'fee_type.update', 'fee_types', after.id, { oldValue: before, newValue: after });
  }
  res.status(200).json(new ApiResponse(200, 'Fee type updated', after));
});

const removeFeeType = asyncHandler(async (req, res) => {
  const record = await feeService.removeFeeType({ accessToken: req.accessToken, id: req.params.id });
  await audit(req, 'fee_type.delete', 'fee_types', record.id, { oldValue: record });
  res.status(200).json(new ApiResponse(200, 'Fee type deleted', { id: record.id }));
});

// ---------------------------------------------------------------------------
// Fee structures
// ---------------------------------------------------------------------------
const listStructures = asyncHandler(async (req, res) => {
  const result = await feeService.listFeeStructures({ accessToken: req.accessToken, query: req.query });
  res.status(200).json(new ApiResponse(200, 'Fee structures retrieved', result));
});

const createStructure = asyncHandler(async (req, res) => {
  const record = await feeService.createFeeStructure({ accessToken: req.accessToken, payload: req.body });
  await audit(req, 'fee_structure.create', 'fee_structures', record.id, { newValue: record });
  res.status(201).json(new ApiResponse(201, 'Fee structure created', record));
});

const updateStructure = asyncHandler(async (req, res) => {
  const { before, after, changes } = await feeService.updateFeeStructure({
    accessToken: req.accessToken,
    id: req.params.id,
    payload: req.body,
  });
  if (Object.keys(changes).length > 0) {
    await audit(req, 'fee_structure.update', 'fee_structures', after.id, {
      oldValue: before,
      newValue: after,
    });
  }
  res.status(200).json(new ApiResponse(200, 'Fee structure updated', after));
});

const removeStructure = asyncHandler(async (req, res) => {
  const record = await feeService.removeFeeStructure({ accessToken: req.accessToken, id: req.params.id });
  await audit(req, 'fee_structure.delete', 'fee_structures', record.id, { oldValue: record });
  res.status(200).json(new ApiResponse(200, 'Fee structure deleted', { id: record.id }));
});

// ---------------------------------------------------------------------------
// Student fee assignments
// ---------------------------------------------------------------------------
const listAssignments = asyncHandler(async (req, res) => {
  const result = await feeService.listAssignments({ accessToken: req.accessToken, query: req.query });
  res.status(200).json(new ApiResponse(200, 'Fee assignments retrieved', result));
});

const assignmentDetail = asyncHandler(async (req, res) => {
  const record = await feeService.assignmentDetail({ accessToken: req.accessToken, id: req.params.id });
  res.status(200).json(new ApiResponse(200, 'Fee assignment retrieved', record));
});

const createAssignment = asyncHandler(async (req, res) => {
  const record = await feeService.createAssignment({ accessToken: req.accessToken, payload: req.body });
  await audit(req, 'student_fee.create', 'student_fees', record.id, { newValue: record });
  res.status(201).json(new ApiResponse(201, 'Fee assigned', record));
});

const bulkAssign = asyncHandler(async (req, res) => {
  const records = await feeService.bulkAssign({ accessToken: req.accessToken, payload: req.body });
  await audit(req, 'student_fee.bulk_assign', 'student_fees', null, {
    metadata: { count: records.length, fee_structure_id: req.body?.fee_structure_id },
  });
  res.status(201).json(new ApiResponse(201, 'Fees assigned', records));
});

const updateAssignment = asyncHandler(async (req, res) => {
  const { before, after, changes } = await feeService.updateAssignment({
    accessToken: req.accessToken,
    id: req.params.id,
    payload: req.body,
  });
  if (Object.keys(changes).length > 0) {
    await audit(req, 'student_fee.update', 'student_fees', after.id, { oldValue: before, newValue: after });
  }
  res.status(200).json(new ApiResponse(200, 'Fee assignment updated', after));
});

const removeAssignment = asyncHandler(async (req, res) => {
  const record = await feeService.removeAssignment({ accessToken: req.accessToken, id: req.params.id });
  await audit(req, 'student_fee.delete', 'student_fees', record.id, { oldValue: record });
  res.status(200).json(new ApiResponse(200, 'Fee assignment deleted', { id: record.id }));
});

// ---------------------------------------------------------------------------
// Dashboard + reports
// ---------------------------------------------------------------------------
const dashboard = asyncHandler(async (req, res) => {
  const result = await feeService.feeDashboard({ accessToken: req.accessToken, query: req.query });
  res.status(200).json(new ApiResponse(200, 'Fee dashboard retrieved', result));
});

const studentHistory = asyncHandler(async (req, res) => {
  const result = await feeService.studentFeeHistory({
    accessToken: req.accessToken,
    studentId: req.params.studentId,
  });
  res.status(200).json(new ApiResponse(200, 'Student fee history retrieved', result));
});

const collectionsReport = asyncHandler(async (req, res) => {
  const result = await feeService.collectionsReport({ accessToken: req.accessToken, query: req.query });
  res.status(200).json(new ApiResponse(200, 'Collection report retrieved', result));
});

const outstandingReport = asyncHandler(async (req, res) => {
  const result = await feeService.outstandingReport({ accessToken: req.accessToken, query: req.query });
  res.status(200).json(new ApiResponse(200, 'Outstanding report retrieved', result));
});

module.exports = {
  listFeeTypes,
  createFeeType,
  updateFeeType,
  removeFeeType,
  listStructures,
  createStructure,
  updateStructure,
  removeStructure,
  listAssignments,
  assignmentDetail,
  createAssignment,
  bulkAssign,
  updateAssignment,
  removeAssignment,
  dashboard,
  studentHistory,
  collectionsReport,
  outstandingReport,
};
