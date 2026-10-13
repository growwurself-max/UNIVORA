const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const authController = require('../controllers/authController');

const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
];

const loginValidation = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

const router = require('express').Router();
const env = require('../config/env');

router.post('/register', validate(registerValidation), authController.register);
router.post('/login', validate(loginValidation), authController.login);
router.get('/me', authenticate, authController.getMe);

// Demo user setup route (development only)
if (!env.isProduction) {
  router.post('/demo/setup', authController.createDemoUser);
}

module.exports = router;
