const router = require('express').Router();
const healthRoutes = require('./healthRoutes');
const authRoutes = require('./authRoutes');
const institutionRoutes = require('./institutionRoutes');
const academicRoutes = require('./academicRoutes');
const timetableRoutes = require('./timetableRoutes');
const attendanceRoutes = require('./attendanceRoutes');
const examRoutes = require('./examRoutes');
const resultRoutes = require('./resultRoutes');

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/institutions', institutionRoutes);
router.use('/academic', academicRoutes);
router.use('/timetable', timetableRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/exams', examRoutes);
router.use('/results', resultRoutes);

module.exports = router;
