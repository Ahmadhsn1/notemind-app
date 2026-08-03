const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  // Not required — accounts created via Google Sign-In (see authController.googleAuth)
  // have no password to check against; they authenticate by Google credential only.
  password: {
    type: String,
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true,
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  lastLoginAt: {
    type: Date,
    default: null,
  },
  // Updated on real ongoing activity (see middleware/authMiddleware.js's
  // `protect`, throttled to at most once/minute per user), unlike
  // lastLoginAt above which only ever reflects the moment a session started
  // and stays frozen for as long as that session keeps getting reused. This
  // is what the admin dashboard's "Last active" column actually means.
  lastActiveAt: {
    type: Date,
    default: null,
  },
  // Checked at login only (password and Google), not on every request via
  // `protect` — that would mean a DB read on every single API call in the
  // app for a check that only needs to matter at the moment a new session is
  // issued. An already-signed-in suspended user keeps that session until it
  // expires (7 days) or they log out; see adminController.toggleSuspension.
  suspended: {
    type: Boolean,
    default: false,
  },
  // Set whenever the password changes through a path that should end other
  // sessions (currently the emailed reset flow). `protect` rejects any token
  // issued before this timestamp, which is the app's only session-revocation
  // mechanism — JWTs are otherwise stateless and valid for their full 7 days
  // with no denylist. Null for accounts whose password has never been reset,
  // which is the correct "no revocation point" default.
  passwordChangedAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
