const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const resourceController = require('../controllers/resourceController');

// Any authenticated member of an institution may read (RLS scopes rows to the
// caller's own institution). Only owners/admins/super admins may mutate.
const requireAdmin = authorize('owner', 'admin', 'super_admin');

router.use(authenticate);

router.get('/stats', resourceController.stats);

router.get('/:resource', resourceController.list);
router.post('/:resource', requireAdmin, resourceController.create);
router.get('/:resource/:id', resourceController.detail);
router.patch('/:resource/:id', requireAdmin, resourceController.update);
router.delete('/:resource/:id', requireAdmin, resourceController.remove);

module.exports = router;
