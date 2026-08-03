const mongoose = require('mongoose');

// Reset tokens are stored as a SHA-256 hash, never in plaintext — the raw
// token exists only in the email that was sent. A read-only leak of this
// collection (a backup, a log, a compromised analytics pipeline) therefore
// grants no ability to reset anyone's password, which is exactly the risk of
// storing them directly.
//
// SHA-256 rather than bcrypt is correct here: unlike a password, the token is
// 32 bytes of CSPRNG output, so there is no dictionary to attack and no need
// for a slow KDF — and lookup must be a single indexed query.
const passwordResetTokenSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  tokenHash: {
    type: String,
    required: true,
    unique: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
}, { timestamps: true });

// Mongo removes expired tokens on its own, so an abandoned request can't sit
// redeemable forever if some cleanup path is ever missed. The controller
// still checks expiry explicitly — the TTL monitor only runs about once a
// minute, so it is a garbage collector, not the security boundary.
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('PasswordResetToken', passwordResetTokenSchema);
