const express = require('express');
const feeController = require('../controllers/feeController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Fee types, structures and assignments are financial configuration and are
// managed by institution admins; reads are open to members (RLS-scoped).
const requireAdmin = authorize('owner', 'admin', 'super_admin');

router.use(authenticate);

// Fee types
router.get('/types', feeController.listFeeTypes);
router.post('/types', requireAdmin, feeController.createFeeType);
router.patch('/types/:id', requireAdmin, feeController.updateFeeType);
router.delete('/types/:id', requireAdmin, feeController.removeFeeType);

// Fee structures
router.get('/structures', feeController.listStructures);
router.post('/structures', requireAdmin, feeController.createStructure);
router.patch('/structures/:id', requireAdmin, feeController.updateStructure);
router.delete('/structures/:id', requireAdmin, feeController.removeStructure);

// Student fee assignments
router.get('/assignments', feeController.listAssignments);
router.post('/assignments', requireAdmin, feeController.createAssignment);
router.post('/assignments/bulk', requireAdmin, feeController.bulkAssign);
router.get('/assignments/:id', feeController.assignmentDetail);
router.patch('/assignments/:id', requireAdmin, feeController.updateAssignment);
router.delete('/assignments/:id', requireAdmin, feeController.removeAssignment);

// Dashboard + reports + student history
router.get('/dashboard', feeController.dashboard);
router.get('/reports/collections', feeController.collectionsReport);
router.get('/reports/outstanding', feeController.outstandingReport);
router.get('/students/:studentId', feeController.studentHistory);

module.exports = router;
