const router = require('express').Router();
const healthRoutes = require('./healthRoutes');
const authRoutes = require('./authRoutes');
const institutionRoutes = require('./institutionRoutes');
const academicRoutes = require('./academicRoutes');
const timetableRoutes = require('./timetableRoutes');
const attendanceRoutes = require('./attendanceRoutes');
const examRoutes = require('./examRoutes');
const resultRoutes = require('./resultRoutes');
const feeRoutes = require('./feeRoutes');
const paymentRoutes = require('./paymentRoutes');
const payrollRoutes = require('./payrollRoutes');

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/institutions', institutionRoutes);
router.use('/academic', academicRoutes);
router.use('/timetable', timetableRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/exams', examRoutes);
router.use('/results', resultRoutes);
router.use('/fees', feeRoutes);
router.use('/payments', paymentRoutes);
router.use('/payroll', payrollRoutes);

module.exports = router;
