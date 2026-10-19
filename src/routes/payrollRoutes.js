const express = require('express');
const payrollController = require('../controllers/payrollController');
const { authenticate, requireCollegeAdmin } = require('../middleware/auth');

const router = express.Router();

// Payroll contains sensitive salary information and is restricted to
// institution admins at both the route and RLS layers.
const requireAdmin = requireCollegeAdmin;

router.use(authenticate);
router.use(requireAdmin);

// Employees available for salary structures (faculty + staff)
router.get('/employees', payrollController.listEmployees);

// Salary structures
router.get('/structures', payrollController.listStructures);
router.post('/structures', payrollController.createStructure);
router.patch('/structures/:id', payrollController.updateStructure);
router.delete('/structures/:id', payrollController.removeStructure);

// Payroll runs
router.get('/runs', payrollController.listRuns);
router.post('/runs', payrollController.createRun);
router.get('/runs/:id', payrollController.runDetail);
router.patch('/runs/:id', payrollController.updateRun);
router.delete('/runs/:id', payrollController.removeRun);
router.post('/runs/:id/generate', payrollController.generateRun);

// Payroll records
router.patch('/records/:id', payrollController.updateRecord);
router.delete('/records/:id', payrollController.removeRecord);

// Reports
router.get('/reports/monthly', payrollController.monthlyReport);

module.exports = router;
