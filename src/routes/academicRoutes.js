const router = require('express').Router();
const {
  authenticate,
  authorize,
  requireCollegeAdmin,
  requireRecordsManager,
} = require('../middleware/auth');
const resourceController = require('../controllers/resourceController');

// Any authenticated member of an institution may read (RLS scopes rows to the
// caller's own institution). Only authorized staff may mutate.
const requireAdmin = requireCollegeAdmin;

const READ_ROLES = {
  departments: ['College Admin', 'Super Admin', 'Student Records Manager', 'Department Head'],
  'academic-years': ['College Admin', 'Super Admin', 'Teacher', 'Exam Coordinator', 'Student Records Manager', 'Accountant'],
  terms: ['College Admin', 'Super Admin', 'Teacher', 'Exam Coordinator', 'Student Records Manager', 'Accountant'],
  subjects: ['College Admin', 'Super Admin', 'Teacher', 'Exam Coordinator', 'Department Head', 'Student Records Manager'],
  courses: ['College Admin', 'Super Admin', 'Teacher', 'Exam Coordinator', 'Department Head', 'Student Records Manager'],
  faculty: ['College Admin', 'Super Admin', 'Teacher', 'Department Head'],
  students: ['College Admin', 'Super Admin', 'Student Records Manager', 'Teacher', 'Student'],
  classes: ['College Admin', 'Super Admin', 'Teacher', 'Exam Coordinator', 'Department Head', 'Student Records Manager', 'Student', 'Accountant'],
  enrollments: ['College Admin', 'Super Admin', 'Teacher', 'Student Records Manager', 'Student', 'Accountant'],
};

const requireResourceReader = (req, res, next) => {
  const roles = READ_ROLES[req.params.resource];
  return roles ? authorize(...roles)(req, res, next) : next();
};

router.use(authenticate);

router.get(
  '/stats',
  authorize('College Admin', 'Super Admin', 'Teacher', 'Department Head', 'Student Records Manager'),
  resourceController.stats
);

router.get('/:resource', requireResourceReader, resourceController.list);
// Student profiles and admissions are managed by Records Manager or College Admin
router.post('/:resource', (req, res, next) => {
  const resource = req.params.resource;
  if (resource === 'students') {
    return requireRecordsManager(req, res, next);
  }
  return requireAdmin(req, res, next);
}, resourceController.create);

router.get('/:resource/:id', requireResourceReader, resourceController.detail);
// Update student profiles is restricted to Records Manager or College Admin
router.patch('/:resource/:id', (req, res, next) => {
  const resource = req.params.resource;
  if (resource === 'students') {
    return requireRecordsManager(req, res, next);
  }
  return requireAdmin(req, res, next);
}, resourceController.update);

router.delete('/:resource/:id', (req, res, next) => {
  if (req.params.resource === 'students') {
    return requireRecordsManager(req, res, next);
  }
  return requireAdmin(req, res, next);
}, resourceController.remove);

module.exports = router;
