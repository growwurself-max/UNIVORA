const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const timetableService = require('../services/timetableService');
const auditService = require('../services/auditService');

const list = asyncHandler(async (req, res) => {
  const result = await timetableService.list({
    accessToken: req.accessToken,
    query: req.query,
  });
  res.status(200).json(new ApiResponse(200, 'Timetable retrieved', result));
});

const detail = asyncHandler(async (req, res) => {
  const result = await timetableService.detail({
    accessToken: req.accessToken,
    id: req.params.id,
  });
  res.status(200).json(new ApiResponse(200, 'Timetable entry retrieved', result));
});

const create = asyncHandler(async (req, res) => {
  const record = await timetableService.create({
    accessToken: req.accessToken,
    payload: req.body,
  });

  await auditService.logAction({
    actorId: req.user.id,
    action: 'timetable.create',
    entityType: 'timetable_entries',
    entityId: record.id,
    newValue: record,
    ip: req.ip,
  });

  res.status(201).json(new ApiResponse(201, 'Timetable entry created', record));
});

const update = asyncHandler(async (req, res) => {
  const { before, after, changes } = await timetableService.update({
    accessToken: req.accessToken,
    id: req.params.id,
    payload: req.body,
  });

  if (Object.keys(changes).length > 0) {
    await auditService.logAction({
      actorId: req.user.id,
      action: 'timetable.update',
      entityType: 'timetable_entries',
      entityId: after.id,
      oldValue: before,
      newValue: after,
      ip: req.ip,
    });
  }

  res.status(200).json(new ApiResponse(200, 'Timetable entry updated', after));
});

const remove = asyncHandler(async (req, res) => {
  const record = await timetableService.remove({
    accessToken: req.accessToken,
    id: req.params.id,
  });

  await auditService.logAction({
    actorId: req.user.id,
    action: 'timetable.delete',
    entityType: 'timetable_entries',
    entityId: record.id,
    oldValue: record,
    ip: req.ip,
  });

  res.status(200).json(new ApiResponse(200, 'Timetable entry deleted', record));
});

module.exports = { list, detail, create, update, remove };
