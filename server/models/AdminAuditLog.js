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
    enum: ['promote', 'demote', 'suspend', 'unsuspend', 'delete_user', 'reset_password', 'delete_note'],
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
}, { timestamps: true });

adminAuditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AdminAuditLog', adminAuditLogSchema);
