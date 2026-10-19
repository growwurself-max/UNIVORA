const express = require('express');
const examController = require('../controllers/examController');
const {
  authenticate,
  authorize,
  requireCollegeAdmin,
  requireExamCoordinator,
} = require('../middleware/auth');

const router = express.Router();

// Exams and marks are managed by faculty and above; exam types and grading
// scales are administrative configuration.
const requireStaff = authorize('Teacher', 'Exam Coordinator', 'College Admin', 'Super Admin');
const requireAdmin = requireCollegeAdmin;
const requireCoord = requireExamCoordinator;

router.use(authenticate);

// Exam types
router.get('/types', examController.listExamTypes);
router.post('/types', requireAdmin, examController.createExamType);
router.patch('/types/:id', requireAdmin, examController.updateExamType);
router.delete('/types/:id', requireAdmin, examController.removeExamType);

// Grading scales
router.get('/grading-scales', examController.listGradingScales);
router.post('/grading-scales', requireAdmin, examController.createGradingScale);
router.patch('/grading-scales/:id', requireAdmin, examController.updateGradingScale);
router.delete('/grading-scales/:id', requireAdmin, examController.removeGradingScale);

// Exams
router.get('/', examController.listExams);
router.post('/', requireCoord, examController.createExam);
router.get('/:id', examController.examDetail);
router.patch('/:id', requireStaff, examController.updateExam);
router.delete('/:id', requireAdmin, examController.removeExam);

// Marks + exam-wise results
router.get('/:id/marks', examController.listMarks);
router.post('/:id/marks', requireStaff, examController.saveMarks);
router.get('/:id/results', examController.examResults);

module.exports = router;
