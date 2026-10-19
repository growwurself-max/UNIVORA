const express = require('express');
const controller = require('../controllers/notificationController');
const { authenticate, requireCollegeAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', controller.list);
router.patch('/:id/read', controller.markRead);
router.post('/', requireCollegeAdmin, controller.create);
router.delete('/:id', requireCollegeAdmin, controller.remove);

module.exports = router;
