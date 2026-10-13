const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const resourceService = require('../services/resourceService');
const auditService = require('../services/auditService');

const list = asyncHandler(async (req, res) => {
  const result = await resourceService.list({
    accessToken: req.accessToken,
    resourceKey: req.params.resource,
    query: req.query,
  });
  res.status(200).json(new ApiResponse(200, 'Records retrieved', result));
});

const stats = asyncHandler(async (req, res) => {
  const result = await resourceService.getStats({ accessToken: req.accessToken });
  res.status(200).json(new ApiResponse(200, 'Academic statistics retrieved', result));
});

const detail = asyncHandler(async (req, res) => {
  const result = await resourceService.detail({
    accessToken: req.accessToken,
    resourceKey: req.params.resource,
    id: req.params.id,
  });
  res.status(200).json(new ApiResponse(200, 'Record retrieved', result));
});

const create = asyncHandler(async (req, res) => {
  const resource = req.params.resource;
  const record = await resourceService.create({
    accessToken: req.accessToken,
    resourceKey: resource,
    payload: req.body,
  });

  await auditService.logAction({
    actorId: req.user.id,
    action: `${resource}.create`,
    entityType: resource,
    entityId: record.id,
    newValue: record,
    ip: req.ip,
  });

  res.status(201).json(new ApiResponse(201, 'Record created', record));
});

const update = asyncHandler(async (req, res) => {
  const resource = req.params.resource;
  const { before, after, changes } = await resourceService.update({
    accessToken: req.accessToken,
    resourceKey: resource,
    id: req.params.id,
    payload: req.body,
  });

  if (Object.keys(changes).length > 0) {
    await auditService.logAction({
      actorId: req.user.id,
      action: `${resource}.update`,
      entityType: resource,
      entityId: after.id,
      oldValue: before,
      newValue: after,
      metadata: { fields: Object.keys(changes) },
      ip: req.ip,
    });
  }

  res.status(200).json(new ApiResponse(200, 'Record updated', after));
});

const remove = asyncHandler(async (req, res) => {
  const resource = req.params.resource;
  const record = await resourceService.remove({
    accessToken: req.accessToken,
    resourceKey: resource,
    id: req.params.id,
  });

  await auditService.logAction({
    actorId: req.user.id,
    action: `${resource}.delete`,
    entityType: resource,
    entityId: record.id,
    oldValue: record,
    ip: req.ip,
  });

  res.status(200).json(new ApiResponse(200, 'Record deleted', { id: record.id }));
});

module.exports = { list, stats, detail, create, update, remove };
