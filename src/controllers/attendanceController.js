const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const attendanceService = require('../services/attendanceService');
const auditService = require('../services/auditService');

const listSessions = asyncHandler(async (req, res) => {
  const result = await attendanceService.listSessions({
    accessToken: req.accessToken,
    query: req.query,
  });
  res.status(200).json(new ApiResponse(200, 'Attendance sessions retrieved', result));
});

const sessionDetail = asyncHandler(async (req, res) => {
  const result = await attendanceService.sessionDetail({
    accessToken: req.accessToken,
    id: req.params.id,
  });
  res.status(200).json(new ApiResponse(200, 'Attendance session retrieved', result));
});

const createSession = asyncHandler(async (req, res) => {
  const session = await attendanceService.createSession({
    accessToken: req.accessToken,
    payload: req.body,
    actorId: req.user.id,
  });

  await auditService.logAction({
    actorId: req.user.id,
    action: 'attendance.session.create',
    entityType: 'attendance_sessions',
    entityId: session.id,
    newValue: session,
    ip: req.ip,
  });

  res.status(201).json(new ApiResponse(201, 'Attendance session created', session));
});

const removeSession = asyncHandler(async (req, res) => {
  const session = await attendanceService.removeSession({
    accessToken: req.accessToken,
    id: req.params.id,
  });

  await auditService.logAction({
    actorId: req.user.id,
    action: 'attendance.session.delete',
    entityType: 'attendance_sessions',
    entityId: session.id,
    oldValue: session,
    ip: req.ip,
  });

  res.status(200).json(new ApiResponse(200, 'Attendance session deleted', session));
});

const mark = asyncHandler(async (req, res) => {
  const records = await attendanceService.markAttendance({
    accessToken: req.accessToken,
    sessionId: req.params.id,
    records: req.body?.records,
  });

  await auditService.logAction({
    actorId: req.user.id,
    action: 'attendance.mark',
    entityType: 'attendance_sessions',
    entityId: req.params.id,
    metadata: { count: records.length },
    newValue: records,
    ip: req.ip,
  });

  res.status(200).json(new ApiResponse(200, 'Attendance recorded', records));
});

const studentSummary = asyncHandler(async (req, res) => {
  const result = await attendanceService.studentSummary({
    accessToken: req.accessToken,
    studentId: req.params.studentId,
    query: req.query,
  });
  res.status(200).json(new ApiResponse(200, 'Student attendance summary retrieved', result));
});

const classSummary = asyncHandler(async (req, res) => {
  const result = await attendanceService.classSummary({
    accessToken: req.accessToken,
    classId: req.params.classId,
    query: req.query,
  });
  res.status(200).json(new ApiResponse(200, 'Class attendance summary retrieved', result));
});

const alerts = asyncHandler(async (req, res) => {
  const result = await attendanceService.alerts({
    accessToken: req.accessToken,
    query: req.query,
  });
  res.status(200).json(new ApiResponse(200, 'Low-attendance alerts retrieved', result));
});

const getSettings = asyncHandler(async (req, res) => {
  const result = await attendanceService.getSettings({ accessToken: req.accessToken });
  res.status(200).json(new ApiResponse(200, 'Attendance settings retrieved', result));
});

const updateSettings = asyncHandler(async (req, res) => {
  const result = await attendanceService.updateSettings({
    accessToken: req.accessToken,
    payload: req.body,
  });

  await auditService.logAction({
    actorId: req.user.id,
    action: 'attendance.settings.update',
    entityType: 'attendance_settings',
    entityId: result.id,
    newValue: result,
    ip: req.ip,
  });

  res.status(200).json(new ApiResponse(200, 'Attendance settings updated', result));
});

module.exports = {
  listSessions,
  sessionDetail,
  createSession,
  removeSession,
  mark,
  studentSummary,
  classSummary,
  alerts,
  getSettings,
  updateSettings,
};
