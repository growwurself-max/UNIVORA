const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/authService');

const register = asyncHandler(async (req, res) => {
  const { email, password, name } = req.body;
  const result = await authService.register({ email, password, name });
  res.status(201).json(new ApiResponse(201, 'Registration successful', result));
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login({ email, password });
  res.status(200).json(new ApiResponse(200, 'Login successful', result));
});

const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getProfile(req.user.id);
  res.status(200).json(new ApiResponse(200, 'Profile retrieved', { user }));
});

const createDemoUser = asyncHandler(async (req, res) => {
  const result = await authService.createDemoUser();
  res.status(200).json(new ApiResponse(200, 'Demo user setup complete', result));
});

module.exports = {
  register,
  login,
  getMe,
  createDemoUser,
};
