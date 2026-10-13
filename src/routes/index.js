const router = require('express').Router();
const healthRoutes = require('./healthRoutes');
const authRoutes = require('./authRoutes');
const institutionRoutes = require('./institutionRoutes');
const academicRoutes = require('./academicRoutes');
const timetableRoutes = require('./timetableRoutes');
const attendanceRoutes = require('./attendanceRoutes');

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/institutions', institutionRoutes);
router.use('/academic', academicRoutes);
router.use('/timetable', timetableRoutes);
router.use('/attendance', attendanceRoutes);

module.exports = router;
