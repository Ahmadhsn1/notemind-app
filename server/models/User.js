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
  // Checked at login only (password and Google), not on every request via
  // `protect` — that would mean a DB read on every single API call in the
  // app for a check that only needs to matter at the moment a new session is
  // issued. An already-signed-in suspended user keeps that session until it
  // expires (7 days) or they log out; see adminController.toggleSuspension.
  suspended: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
