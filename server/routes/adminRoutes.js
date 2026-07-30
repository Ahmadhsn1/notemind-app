const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const requireAdmin = require('../middleware/adminMiddleware');
const { validateBody } = require('../middleware/validate');
const { updateRoleSchema, suspendSchema, sendNotificationSchema } = require('../validators/adminValidators');
const {
  getAdminStats,
  getAdminUsers,
  getGrowth,
  getAuditLog,
  updateUserRole,
  toggleUserSuspension,
  resetUserPassword,
  deleteUser,
  getUserNotes,
  deleteUserNote,
  sendNotification,
  getAdminNotifications,
  deleteNotification,
} = require('../controllers/adminController');

router.get('/stats', protect, requireAdmin, getAdminStats);
router.get('/growth', protect, requireAdmin, getGrowth);
router.get('/audit-log', protect, requireAdmin, getAuditLog);
router.get('/users', protect, requireAdmin, getAdminUsers);
router.get('/users/:id/notes', protect, requireAdmin, getUserNotes);
router.patch('/users/:id/role', protect, requireAdmin, validateBody(updateRoleSchema), updateUserRole);
router.patch('/users/:id/suspend', protect, requireAdmin, validateBody(suspendSchema), toggleUserSuspension);
router.post('/users/:id/reset-password', protect, requireAdmin, resetUserPassword);
router.delete('/users/:id', protect, requireAdmin, deleteUser);
router.delete('/notes/:noteId', protect, requireAdmin, deleteUserNote);
router.get('/notifications', protect, requireAdmin, getAdminNotifications);
router.post('/notifications', protect, requireAdmin, validateBody(sendNotificationSchema), sendNotification);
router.delete('/notifications/:id', protect, requireAdmin, deleteNotification);

module.exports = router;
