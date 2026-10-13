const express = require('express');
const attendanceController = require('../controllers/attendanceController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Faculty and above may record attendance; only admins may change settings.
const requireStaff = authorize('owner', 'admin', 'super_admin', 'faculty');
const requireAdmin = authorize('owner', 'admin', 'super_admin');

router.use(authenticate);

router.get('/settings', attendanceController.getSettings);
router.patch('/settings', requireAdmin, attendanceController.updateSettings);

router.get('/sessions', attendanceController.listSessions);
router.post('/sessions', requireStaff, attendanceController.createSession);
router.get('/sessions/:id', attendanceController.sessionDetail);
router.delete('/sessions/:id', requireStaff, attendanceController.removeSession);
router.post('/sessions/:id/mark', requireStaff, attendanceController.mark);

router.get('/students/:studentId/summary', attendanceController.studentSummary);
router.get('/classes/:classId/summary', attendanceController.classSummary);
router.get('/alerts', attendanceController.alerts);

module.exports = router;
