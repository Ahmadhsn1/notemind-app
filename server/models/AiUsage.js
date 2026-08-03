const mongoose = require('mongoose');

// One counter document per user per UTC day. The (user, date) unique index is
// what makes the quota check a single atomic upsert-and-increment rather than
// a read-then-write that two concurrent requests could both pass.
//
// This exists because the only spend control in the app was `aiLimiter`, an
// in-memory express-rate-limit keyed on req.ip: it reset on every restart,
// counted an office or a NAT as one user, and attributed nothing. Gemini is
// billed per call, so "who ran up this bill" was unanswerable and "cap one
// account" was impossible.
const aiUsageSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // UTC YYYY-MM-DD. UTC rather than local time so the reset boundary is the
  // same for every user regardless of timezone, and so a user can't get a
  // second allowance by changing their clock.
  date: {
    type: String,
    required: true,
  },
  count: {
    type: Number,
    default: 0,
  },
}, { timestamps: true });

aiUsageSchema.index({ user: 1, date: 1 }, { unique: true });
// Lets old counters age out on their own — nothing reads a day that has
// already reset, and without this the collection grows forever.
aiUsageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

module.exports = mongoose.model('AiUsage', aiUsageSchema);
