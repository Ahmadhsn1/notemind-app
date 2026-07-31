const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const requireAdmin = require('../middleware/adminMiddleware');
const { validateBody } = require('../middleware/validate');
const { updateRoleSchema, suspendSchema, sendNotificationSchema, bulkUserActionSchema } = require('../validators/adminValidators');
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
  getNoteDetail,
  deleteUserNote,
  archiveUserNote,
  unarchiveUserNote,
  trashUserNote,
  restoreUserNote,
  unpinUserNote,
  getUserNoteVersions,
  getUserFlashcards,
  getNoteFlashcardsAdmin,
  deleteUserFlashcard,
  exportUserDataJson,
  exportUserDataMarkdown,
  bulkUserAction,
  getSystemStatus,
  sendNotification,
  getAdminNotifications,
  deleteNotification,
} = require('../controllers/adminController');

router.get('/stats', protect, requireAdmin, getAdminStats);
router.get('/growth', protect, requireAdmin, getGrowth);
router.get('/audit-log', protect, requireAdmin, getAuditLog);
router.get('/system', protect, requireAdmin, getSystemStatus);
router.get('/users', protect, requireAdmin, getAdminUsers);
router.post('/users/bulk', protect, requireAdmin, validateBody(bulkUserActionSchema), bulkUserAction);
router.get('/users/:id/notes', protect, requireAdmin, getUserNotes);
router.get('/users/:id/flashcards', protect, requireAdmin, getUserFlashcards);
router.get('/users/:id/export/json', protect, requireAdmin, exportUserDataJson);
router.get('/users/:id/export/markdown', protect, requireAdmin, exportUserDataMarkdown);
router.patch('/users/:id/role', protect, requireAdmin, validateBody(updateRoleSchema), updateUserRole);
router.patch('/users/:id/suspend', protect, requireAdmin, validateBody(suspendSchema), toggleUserSuspension);
router.post('/users/:id/reset-password', protect, requireAdmin, resetUserPassword);
router.delete('/users/:id', protect, requireAdmin, deleteUser);

router.get('/notes/:noteId', protect, requireAdmin, getNoteDetail);
router.get('/notes/:noteId/versions', protect, requireAdmin, getUserNoteVersions);
router.get('/notes/:noteId/flashcards', protect, requireAdmin, getNoteFlashcardsAdmin);
router.patch('/notes/:noteId/archive', protect, requireAdmin, archiveUserNote);
router.patch('/notes/:noteId/unarchive', protect, requireAdmin, unarchiveUserNote);
router.patch('/notes/:noteId/trash', protect, requireAdmin, trashUserNote);
router.patch('/notes/:noteId/restore', protect, requireAdmin, restoreUserNote);
router.patch('/notes/:noteId/unpin', protect, requireAdmin, unpinUserNote);
router.delete('/notes/:noteId', protect, requireAdmin, deleteUserNote);

router.delete('/flashcards/:flashcardId', protect, requireAdmin, deleteUserFlashcard);

router.get('/notifications', protect, requireAdmin, getAdminNotifications);
router.post('/notifications', protect, requireAdmin, validateBody(sendNotificationSchema), sendNotification);
router.delete('/notifications/:id', protect, requireAdmin, deleteNotification);

module.exports = router;
