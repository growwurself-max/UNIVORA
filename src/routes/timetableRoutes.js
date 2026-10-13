const express = require('express');
const timetableController = require('../controllers/timetableController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Timetable reads are open to any authenticated member of the institution (RLS
// scopes rows); writes are administrative.
const requireAdmin = authorize('owner', 'admin', 'super_admin');

router.use(authenticate);

router.get('/', timetableController.list);
router.post('/', requireAdmin, timetableController.create);
router.get('/:id', timetableController.detail);
router.patch('/:id', requireAdmin, timetableController.update);
router.delete('/:id', requireAdmin, timetableController.remove);

module.exports = router;
