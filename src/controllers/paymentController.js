const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const paymentService = require('../services/paymentService');
const auditService = require('../services/auditService');

const listPayments = asyncHandler(async (req, res) => {
  const result = await paymentService.listPayments({ accessToken: req.accessToken, query: req.query });
  res.status(200).json(new ApiResponse(200, 'Payments retrieved', result));
});

const paymentDetail = asyncHandler(async (req, res) => {
  const record = await paymentService.paymentDetail({ accessToken: req.accessToken, id: req.params.id });
  res.status(200).json(new ApiResponse(200, 'Payment retrieved', record));
});

const createPayment = asyncHandler(async (req, res) => {
  const record = await paymentService.recordPayment({
    accessToken: req.accessToken,
    payload: req.body,
    actorId: req.user.id,
  });

  await auditService.logAction({
    actorId: req.user.id,
    action: 'payment.create',
    entityType: 'payments',
    entityId: record.id,
    newValue: record,
    ip: req.ip,
  });

  res.status(201).json(new ApiResponse(201, 'Payment recorded', record));
});

const removePayment = asyncHandler(async (req, res) => {
  const record = await paymentService.removePayment({ accessToken: req.accessToken, id: req.params.id });

  await auditService.logAction({
    actorId: req.user.id,
    action: 'payment.void',
    entityType: 'payments',
    entityId: record.id,
    oldValue: record,
    ip: req.ip,
  });

  res.status(200).json(new ApiResponse(200, 'Payment voided', { id: record.id }));
});

const receipt = asyncHandler(async (req, res) => {
  const result = await paymentService.receipt({ accessToken: req.accessToken, id: req.params.id });
  res.status(200).json(new ApiResponse(200, 'Receipt retrieved', result));
});

module.exports = {
  listPayments,
  paymentDetail,
  createPayment,
  removePayment,
  receipt,
};
