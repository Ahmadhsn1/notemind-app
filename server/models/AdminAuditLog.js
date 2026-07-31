const mongoose = require('mongoose');

// Snapshots the target's name/email/note-title at the time of the action,
// rather than relying solely on the ref — the target user or note may since
// have been deleted (deleting a user is one of the actions this logs!), and
// the log should still read sensibly after that happens.
const adminAuditLogSchema = new mongoose.Schema({
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  action: {
    type: String,
    enum: [
      'promote', 'demote', 'suspend', 'unsuspend', 'delete_user', 'reset_password',
      'delete_note', 'send_notification', 'delete_notification',
      'archive_note', 'unarchive_note', 'trash_note', 'restore_note', 'permanently_delete_note', 'unpin_note',
      'delete_flashcard',
      'export_user_data',
      'bulk_suspend', 'bulk_unsuspend', 'bulk_delete_user', 'bulk_role_change',
    ],
    required: true,
  },
  targetUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  targetLabel: {
    type: String,
    required: true,
  },
  // Cheap before/after snapshots for mutations where capturing the prior
  // value costs nothing extra (role/suspend changes) — omitted for actions
  // where a snapshot isn't meaningful or cheap (e.g. delete_note, bulk_*).
  before: {
    type: mongoose.Schema.Types.Mixed,
  },
  after: {
    type: mongoose.Schema.Types.Mixed,
  },
}, { timestamps: true });

adminAuditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AdminAuditLog', adminAuditLogSchema);
