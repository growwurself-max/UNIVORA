const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/authService');

const normalizeRole = (role) => {
  const normalized = role.trim().toLowerCase().replace(/[\s-]+/g, '_');
  const roleAliases = {
    super_admin: 'super_admin',
    college_admin: 'college_admin',
    owner: 'college_admin',
    admin: 'college_admin',
    teacher: 'teacher',
    faculty: 'teacher',
    accountant: 'accountant',
    staff: 'accountant',
    student: 'student',
  };
  return roleAliases[normalized] || normalized;
};

const authenticate = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ApiError(401, 'Authentication required');
  }

  const token = authHeader.split(' ')[1];

  const user = await authService.verifyToken(token);
  user.profile = await authService.getAuthorizationProfile(user.id);
  req.user = user;
  req.accessToken = token;
  next();
});

// Secure, reusable permission-checking mechanism.
const authorize = (...allowedRoles) =>
  asyncHandler(async (req, res, next) => {
    const role = req.user.profile?.role;

    const allowedRoleNames = allowedRoles.map(normalizeRole);
    if (!role || !allowedRoleNames.includes(normalizeRole(role))) {
      throw new ApiError(403, 'Insufficient permissions');
    }

    req.role = role;
    next();
  });

// Admin-level roles
const requireSuperAdmin = authorize('Super Admin');
const requireCollegeAdmin = authorize('College Admin', 'Super Admin');

// Specialized staff roles
const requireTeacher = authorize('Teacher', 'College Admin', 'Super Admin');
const requireAccountant = authorize('Accountant', 'College Admin', 'Super Admin');
const requireRecordsManager = authorize('Student Records Manager', 'College Admin', 'Super Admin');
const requireExamCoordinator = authorize('Exam Coordinator', 'College Admin', 'Super Admin');
const requireDeptHead = authorize('Department Head', 'College Admin', 'Super Admin');
const requireOfficeStaff = authorize('Office Staff', 'College Admin', 'Super Admin');
const requireStudent = authorize('Student', 'Teacher', 'Accountant', 'College Admin', 'Super Admin');

module.exports = {
  authenticate,
  authorize,
  requireSuperAdmin,
  requireCollegeAdmin,
  requireTeacher,
  requireAccountant,
  requireStudent,
  requireRecordsManager,
  requireExamCoordinator,
  requireDeptHead,
  requireOfficeStaff
};
