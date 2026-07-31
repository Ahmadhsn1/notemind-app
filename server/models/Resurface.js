const mongoose = require('mongoose');

// One record per user per calendar day — the (user, date) unique index IS
// the caching mechanism for services/resurfaceService.js's daily selection
// job: a missing document means "not computed yet today," not "nothing to
// show," so a no-memory day still gets a method:'none' record saved to avoid
// re-scanning on every subsequent page load that same day.
const resurfaceSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  date: {
    type: String,
    required: true,
  },
  oldNote: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Note',
    default: null,
  },
  anchorNote: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Note',
    default: null,
  },
  method: {
    type: String,
    enum: ['semantic', 'calendar', 'none'],
    required: true,
  },
  reflection: {
    type: String,
    default: '',
  },
  // Set when the user expands the card — a soft "did they even see it"
  // signal, deliberately NOT what the streak is keyed on (see engagedAt).
  viewedAt: {
    type: Date,
    default: null,
  },
  // THE streak signal — set once, only when the user submits the reply
  // action (blank or not). Passive viewing doesn't count: otherwise the
  // streak would trivially inflate just from opening the app, undermining
  // the "you showed up and reflected" premise of a habit streak.
  engagedAt: {
    type: Date,
    default: null,
  },
  engagementReply: {
    type: String,
    default: '',
  },
}, { timestamps: true });

resurfaceSchema.index({ user: 1, date: 1 }, { unique: true });
resurfaceSchema.index({ user: 1, oldNote: 1 });

module.exports = mongoose.model('Resurface', resurfaceSchema);
