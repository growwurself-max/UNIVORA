const express = require('express');
const resultController = require('../controllers/resultController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Any authenticated member may read results; RLS scopes rows to their own
// institution and restricts students to their own marks.
router.use(authenticate);

router.get('/report-card/:studentId', resultController.reportCard);
router.get('/', resultController.results);

module.exports = router;
