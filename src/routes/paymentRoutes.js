const express = require('express');
const paymentController = require('../controllers/paymentController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Recording and voiding payments is restricted to institution admins. Reads are
// available to staff (and a student for their own payments) via RLS.
const requireAdmin = authorize('owner', 'admin', 'super_admin');

router.use(authenticate);

router.get('/', paymentController.listPayments);
router.post('/', requireAdmin, paymentController.createPayment);
router.get('/:id', paymentController.paymentDetail);
router.get('/:id/receipt', paymentController.receipt);
router.delete('/:id', requireAdmin, paymentController.removePayment);

module.exports = router;
