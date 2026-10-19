const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const notificationService = require('../services/notificationService');

const list = asyncHandler(async (req, res) => {
  const result = await notificationService.listNotifications({ accessToken: req.accessToken, query: req.query });
  res.status(200).json(new ApiResponse(200, 'Notifications retrieved', result));
});

const markRead = asyncHandler(async (req, res) => {
  const result = await notificationService.markAsRead({ accessToken: req.accessToken, id: req.params.id });
  res.status(200).json(new ApiResponse(200, 'Notification marked as read', result));
});

const create = asyncHandler(async (req, res) => {
  const result = await notificationService.createNotification({ accessToken: req.accessToken, payload: req.body });
  res.status(201).json(new ApiResponse(201, 'Notification created', result));
});

const remove = asyncHandler(async (req, res) => {
  const result = await notificationService.deleteNotification({ accessToken: req.accessToken, id: req.params.id });
  res.status(200).json(new ApiResponse(200, 'Notification deleted', result));
});

module.exports = { list, markRead, create, remove };
