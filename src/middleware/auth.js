const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/authService');

const authenticate = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ApiError(401, 'Authentication required');
  }

  const token = authHeader.split(' ')[1];

  const user = await authService.verifyToken(token);
  req.user = user;
  req.accessToken = token;
  next();
});

// Role-based authorization. The role comes from the caller's own profile row,
// never from the request body, so self-escalation is impossible here and the
// same role is enforced by PostgreSQL RLS on every query the user's token makes.
const authorize = (...allowedRoles) =>
  asyncHandler(async (req, res, next) => {
    const role = await authService.getRole(req.user.id);

    if (!role || !allowedRoles.includes(role)) {
      throw new ApiError(403, 'Insufficient permissions');
    }

    req.role = role;
    next();
  });

const requireSuperAdmin = authorize('super_admin');

module.exports = { authenticate, authorize, requireSuperAdmin };
