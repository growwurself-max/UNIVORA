const express = require('express');
const controller = require('../controllers/reportController');
const {
  authenticate,
  authorize,
  requireCollegeAdmin,
  requireRecordsManager,
  requireTeacher,
} = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/students', requireRecordsManager, controller.students);
router.get('/faculty', requireCollegeAdmin, controller.faculty);
router.get('/attendance', requireTeacher, controller.attendance);
router.get(
  '/exams-results',
  authorize('Teacher', 'Exam Coordinator', 'College Admin', 'Super Admin'),
  controller.examsResults
);

module.exports = router;
