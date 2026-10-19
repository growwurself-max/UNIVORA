const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const settingsService = require('../services/settingsService');

const institutionGet = asyncHandler(async (req, res) => {
  const result = await settingsService.getInstitutionSettings({ accessToken: req.accessToken });
  res.status(200).json(new ApiResponse(200, 'Institution settings retrieved', result));
});

const institutionUpsert = asyncHandler(async (req, res) => {
  const result = await settingsService.upsertInstitutionSettings({ accessToken: req.accessToken, payload: req.body });
  res.status(200).json(new ApiResponse(200, 'Institution settings saved', result));
});

const prefsGet = asyncHandler(async (req, res) => {
  const result = await settingsService.getUserPreferences({ accessToken: req.accessToken });
  res.status(200).json(new ApiResponse(200, 'User preferences retrieved', result));
});

const prefsUpsert = asyncHandler(async (req, res) => {
  const result = await settingsService.upsertUserPreferences({
    accessToken: req.accessToken,
    profileId: req.user.id,
    payload: req.body,
  });
  res.status(200).json(new ApiResponse(200, 'User preferences saved', result));
});

module.exports = { institutionGet, institutionUpsert, prefsGet, prefsUpsert };
