const mongoose = require('mongoose');

// `recipients` is a concrete, resolved-at-send-time list of user ids —
// "all users" means everyone who existed at the moment it was sent, not a
// dynamic group that would retroactively include people who sign up later.
const notificationSchema = new mongoose.Schema({
  message: {
    type: String,
    required: true,
    trim: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  recipients: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  readBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
}, { timestamps: true });

// Backs both admin's "recent sends" list and the per-user inbox fetch.
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ recipients: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
