const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const examService = require('../services/examService');
const auditService = require('../services/auditService');

// ---------------------------------------------------------------------------
// Exam types
// ---------------------------------------------------------------------------
const listExamTypes = asyncHandler(async (req, res) => {
  const result = await examService.listExamTypes({
    accessToken: req.accessToken,
    query: req.query,
  });
  res.status(200).json(new ApiResponse(200, 'Exam types retrieved', result));
});

const createExamType = asyncHandler(async (req, res) => {
  const record = await examService.createExamType({
    accessToken: req.accessToken,
    payload: req.body,
  });

  await auditService.logAction({
    actorId: req.user.id,
    action: 'exam_type.create',
    entityType: 'exam_types',
    entityId: record.id,
    newValue: record,
    ip: req.ip,
  });

  res.status(201).json(new ApiResponse(201, 'Exam type created', record));
});

const updateExamType = asyncHandler(async (req, res) => {
  const { before, after, changes } = await examService.updateExamType({
    accessToken: req.accessToken,
    id: req.params.id,
    payload: req.body,
  });

  if (Object.keys(changes).length > 0) {
    await auditService.logAction({
      actorId: req.user.id,
      action: 'exam_type.update',
      entityType: 'exam_types',
      entityId: after.id,
      oldValue: before,
      newValue: after,
      ip: req.ip,
    });
  }

  res.status(200).json(new ApiResponse(200, 'Exam type updated', after));
});

const removeExamType = asyncHandler(async (req, res) => {
  const record = await examService.removeExamType({
    accessToken: req.accessToken,
    id: req.params.id,
  });

  await auditService.logAction({
    actorId: req.user.id,
    action: 'exam_type.delete',
    entityType: 'exam_types',
    entityId: record.id,
    oldValue: record,
    ip: req.ip,
  });

  res.status(200).json(new ApiResponse(200, 'Exam type deleted', { id: record.id }));
});

// ---------------------------------------------------------------------------
// Grading scales
// ---------------------------------------------------------------------------
const listGradingScales = asyncHandler(async (req, res) => {
  const result = await examService.listGradingScales({
    accessToken: req.accessToken,
    query: req.query,
  });
  res.status(200).json(new ApiResponse(200, 'Grading scales retrieved', result));
});

const createGradingScale = asyncHandler(async (req, res) => {
  const record = await examService.createGradingScale({
    accessToken: req.accessToken,
    payload: req.body,
  });

  await auditService.logAction({
    actorId: req.user.id,
    action: 'grading_scale.create',
    entityType: 'grading_scales',
    entityId: record.id,
    newValue: record,
    ip: req.ip,
  });

  res.status(201).json(new ApiResponse(201, 'Grading scale created', record));
});

const updateGradingScale = asyncHandler(async (req, res) => {
  const { before, after, changes } = await examService.updateGradingScale({
    accessToken: req.accessToken,
    id: req.params.id,
    payload: req.body,
  });

  await auditService.logAction({
    actorId: req.user.id,
    action: 'grading_scale.update',
    entityType: 'grading_scales',
    entityId: after.id,
    oldValue: before,
    newValue: after,
    metadata: { fields: Object.keys(changes) },
    ip: req.ip,
  });

  res.status(200).json(new ApiResponse(200, 'Grading scale updated', after));
});

const removeGradingScale = asyncHandler(async (req, res) => {
  const record = await examService.removeGradingScale({
    accessToken: req.accessToken,
    id: req.params.id,
  });

  await auditService.logAction({
    actorId: req.user.id,
    action: 'grading_scale.delete',
    entityType: 'grading_scales',
    entityId: record.id,
    oldValue: record,
    ip: req.ip,
  });

  res.status(200).json(new ApiResponse(200, 'Grading scale deleted', { id: record.id }));
});

// ---------------------------------------------------------------------------
// Exams
// ---------------------------------------------------------------------------
const listExams = asyncHandler(async (req, res) => {
  const result = await examService.listExams({ accessToken: req.accessToken, query: req.query });
  res.status(200).json(new ApiResponse(200, 'Exams retrieved', result));
});

const examDetail = asyncHandler(async (req, res) => {
  const result = await examService.examDetail({ accessToken: req.accessToken, id: req.params.id });
  res.status(200).json(new ApiResponse(200, 'Exam retrieved', result));
});

const createExam = asyncHandler(async (req, res) => {
  const record = await examService.createExam({
    accessToken: req.accessToken,
    payload: req.body,
  });

  await auditService.logAction({
    actorId: req.user.id,
    action: 'exam.create',
    entityType: 'exams',
    entityId: record.id,
    newValue: record,
    ip: req.ip,
  });

  res.status(201).json(new ApiResponse(201, 'Exam created', record));
});

const updateExam = asyncHandler(async (req, res) => {
  const { before, after, changes } = await examService.updateExam({
    accessToken: req.accessToken,
    id: req.params.id,
    payload: req.body,
  });

  if (Object.keys(changes).length > 0) {
    await auditService.logAction({
      actorId: req.user.id,
      action: 'exam.update',
      entityType: 'exams',
      entityId: after.id,
      oldValue: before,
      newValue: after,
      ip: req.ip,
    });
  }

  res.status(200).json(new ApiResponse(200, 'Exam updated', after));
});

const removeExam = asyncHandler(async (req, res) => {
  const record = await examService.removeExam({ accessToken: req.accessToken, id: req.params.id });

  await auditService.logAction({
    actorId: req.user.id,
    action: 'exam.delete',
    entityType: 'exams',
    entityId: record.id,
    oldValue: record,
    ip: req.ip,
  });

  res.status(200).json(new ApiResponse(200, 'Exam deleted', { id: record.id }));
});

// ---------------------------------------------------------------------------
// Marks
// ---------------------------------------------------------------------------
const listMarks = asyncHandler(async (req, res) => {
  const result = await examService.listMarks({ accessToken: req.accessToken, examId: req.params.id });
  res.status(200).json(new ApiResponse(200, 'Marks retrieved', result));
});

const saveMarks = asyncHandler(async (req, res) => {
  const records = await examService.saveMarks({
    accessToken: req.accessToken,
    examId: req.params.id,
    records: req.body?.records,
    actorId: req.user.id,
  });

  await auditService.logAction({
    actorId: req.user.id,
    action: 'exam.marks.save',
    entityType: 'exam_marks',
    entityId: req.params.id,
    metadata: { count: records.length },
    newValue: records,
    ip: req.ip,
  });

  res.status(200).json(new ApiResponse(200, 'Marks saved', records));
});

const examResults = asyncHandler(async (req, res) => {
  const result = await examService.examResults({
    accessToken: req.accessToken,
    examId: req.params.id,
  });
  res.status(200).json(new ApiResponse(200, 'Exam results retrieved', result));
});

module.exports = {
  listExamTypes,
  createExamType,
  updateExamType,
  removeExamType,
  listGradingScales,
  createGradingScale,
  updateGradingScale,
  removeGradingScale,
  listExams,
  examDetail,
  createExam,
  updateExam,
  removeExam,
  listMarks,
  saveMarks,
  examResults,
};
