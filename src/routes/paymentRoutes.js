const express = require('express');
const paymentController = require('../controllers/paymentController');
const { authenticate, requireAccountant } = require('../middleware/auth');

const router = express.Router();

// Recording and voiding payments is restricted to institution admins. Reads are
// available to staff (and a student for their own payments) via RLS.
const requireAdmin = requireAccountant;

router.use(authenticate);

router.get('/', paymentController.listPayments);
router.post('/', requireAdmin, paymentController.createPayment);
router.get('/:id', paymentController.paymentDetail);
router.get('/:id/receipt', paymentController.receipt);

module.exports = router;
