const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, requireSuperAdmin } = require('../middleware/auth');
const institutionController = require('../controllers/institutionController');

const optional = { values: 'falsy' };

const nameRule = (required) => {
  const rule = body('name');
  return required
    ? rule.trim().notEmpty().withMessage('Institution name is required').isLength({ max: 200 })
    : rule.optional(optional).trim().notEmpty().isLength({ max: 200 });
};

const commonRules = [
  body('slug')
    .optional(optional)
    .trim()
    .matches(/^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/)
    .withMessage('Slug must be lowercase letters, numbers, and hyphens'),
  body('domain').optional(optional).trim().isLength({ max: 255 }),
  body('status')
    .optional(optional)
    .trim()
    .toLowerCase()
    .isIn(['active', 'suspended'])
    .withMessage('Status must be active or suspended'),
  body('subscription_plan')
    .optional(optional)
    .trim()
    .toLowerCase()
    .isIn(['free', 'basic', 'pro', 'enterprise'])
    .withMessage('Invalid subscription plan'),
  body('subscription_expires_at').optional(optional).trim().isISO8601().withMessage('Invalid date'),
];

const createValidation = [nameRule(true), ...commonRules];
const updateValidation = [nameRule(false), ...commonRules];

const statusValidation = [
  body('status')
    .trim()
    .toLowerCase()
    .isIn(['active', 'suspended'])
    .withMessage('Status must be active or suspended'),
  body('reason').optional(optional).trim().isLength({ max: 500 }),
];

const router = require('express').Router();

router.use(authenticate, requireSuperAdmin);

router.get('/stats', institutionController.stats);
router.get('/', institutionController.list);
router.post('/', validate(createValidation), institutionController.create);
router.get('/:id', institutionController.detail);
router.patch('/:id/status', validate(statusValidation), institutionController.setStatus);
router.patch('/:id', validate(updateValidation), institutionController.update);
router.delete('/:id', institutionController.remove);

module.exports = router;
