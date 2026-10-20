const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const institutionService = require('../services/institutionService');
const auditService = require('../services/auditService');

const list = asyncHandler(async (req, res) => {
  const { search, status, subscription_plan: subscriptionPlan, page, limit } = req.query;
  const result = await institutionService.listInstitutions({
    accessToken: req.accessToken,
    search,
    status,
    subscriptionPlan,
    page,
    limit,
  });
  res.status(200).json(new ApiResponse(200, 'Institutions retrieved', result));
});

const stats = asyncHandler(async (req, res) => {
  const result = await institutionService.getInstitutionStats({ accessToken: req.accessToken });
  res.status(200).json(new ApiResponse(200, 'Institution statistics retrieved', result));
});

const detail = asyncHandler(async (req, res) => {
  const result = await institutionService.getInstitutionDetail({
    accessToken: req.accessToken,
    id: req.params.id,
  });
  res.status(200).json(new ApiResponse(200, 'Institution retrieved', result));
});

const create = asyncHandler(async (req, res) => {
  const institution = await institutionService.createInstitution({
    accessToken: req.accessToken,
    payload: req.body,
  });

  await auditService.logAction({
    actorId: req.user.id,
    action: 'institution.create',
    entityType: 'institution',
    entityId: institution.id,
    newValue: institution,
    ip: req.ip,
  });

  res.status(201).json(new ApiResponse(201, 'Institution created', institution));
});

const update = asyncHandler(async (req, res) => {
  const { before, after, changes } = await institutionService.updateInstitution({
    accessToken: req.accessToken,
    id: req.params.id,
    payload: req.body,
  });

  if (Object.keys(changes).length > 0) {
    let action = 'institution.update';
    if (changes.status !== undefined && changes.status !== before.status) {
      action = 'institution.status';
    } else if (
      changes.subscription_plan !== undefined &&
      changes.subscription_plan !== before.subscription_plan
    ) {
      action = 'institution.plan';
    }

    await auditService.logAction({
      actorId: req.user.id,
      action,
      entityType: 'institution',
      entityId: after.id,
      oldValue: before,
      newValue: after,
      metadata: { fields: Object.keys(changes) },
      ip: req.ip,
    });
  }

  res.status(200).json(new ApiResponse(200, 'Institution updated', after));
});

const remove = asyncHandler(async (req, res) => {
  const { before, after, changes } = await institutionService.deactivateInstitution({
    accessToken: req.accessToken,
    id: req.params.id,
  });

  if (Object.keys(changes).length > 0) {
    await auditService.logAction({
      actorId: req.user.id,
      action: 'institution.deactivate',
      entityType: 'institution',
      entityId: after.id,
      oldValue: before,
      newValue: after,
      metadata: { method: 'soft-delete', recordsPreserved: true },
      ip: req.ip,
    });
  }

  res.status(200).json(
    new ApiResponse(200, 'Institution deactivated; its academic and account records were preserved', after)
  );
});

const setStatus = asyncHandler(async (req, res) => {
  const { before, after } = await institutionService.updateInstitution({
    accessToken: req.accessToken,
    id: req.params.id,
    payload: { status: req.body.status },
  });

  await auditService.logAction({
    actorId: req.user.id,
    action: 'institution.status',
    entityType: 'institution',
    entityId: after.id,
    oldValue: { status: before.status },
    newValue: { status: after.status },
    metadata: { reason: req.body.reason || null },
    ip: req.ip,
  });

  res.status(200).json(new ApiResponse(200, `Institution ${after.status}`, after));
});

module.exports = { list, stats, detail, create, update, remove, setStatus };
