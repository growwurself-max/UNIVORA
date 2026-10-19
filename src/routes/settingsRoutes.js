const express = require('express');
const controller = require('../controllers/settingsController');
const { authenticate, requireCollegeAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/institution', controller.institutionGet);
router.put('/institution', requireCollegeAdmin, controller.institutionUpsert);

router.get('/preferences', controller.prefsGet);
router.put('/preferences', controller.prefsUpsert);

module.exports = router;
