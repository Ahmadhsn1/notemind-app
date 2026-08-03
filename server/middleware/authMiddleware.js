const jwt = require('jsonwebtoken');
const User = require('../models/User');

// How often a given user's lastActiveAt actually gets written. Most requests
// match zero documents (cheap indexed _id lookup, not a real write), so this
// stays a single-digit-ms check rather than a write storm.
const ACTIVITY_UPDATE_THROTTLE_MS = 60 * 1000;

// Verifying the JWT signature alone is not enough to call a session valid.
// The token carries only { id }, lives for 7 days, and there is no revocation
// list — so a signature-only check meant:
//   - a deleted account kept working for up to a week, its open tab creating
//     notes owned by a user id that no longer existed; and
//   - suspending an abusive user did nothing until their token expired, which
//     is exactly the window in which suspension needs to bite.
// The user is therefore loaded on every authenticated request. adminMiddleware
// already did this for admin routes; this extends the same freshness
// guarantee to the rest of the API, and passes `role` along so admin routes
// don't repeat the query.
//
// Both rejections are 401 rather than 403, deliberately: the client's axios
// interceptor (client/src/api/axios.js) treats 401 as "session over" and
// clears storage + redirects to /login. A 403 would instead leave a suspended
// user stuck in an endlessly erroring UI, still apparently signed in. Sending
// them to /login is right — their next login attempt gets the real
// "This account has been suspended." message from loginUser.
const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided, access denied' });
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  let user;
  try {
    user = await User.findById(decoded.id).select('role suspended lastActiveAt passwordChangedAt');
  } catch {
    // A malformed id inside a validly-signed token isn't a server fault —
    // report it as a dead session instead of letting a CastError 500.
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  if (!user) {
    return res.status(401).json({ message: 'Account no longer exists' });
  }

  if (user.suspended) {
    return res.status(401).json({ message: 'This account has been suspended.' });
  }

  // Session revocation. A password reset is normally performed *because* the
  // account is believed compromised, so leaving previously-issued tokens
  // valid for the rest of their 7-day life would defeat the point. `iat` is
  // in seconds; the comparison floors passwordChangedAt to the same
  // resolution so a token minted in the same second as the reset (the user's
  // own new session) isn't rejected by rounding.
  if (user.passwordChangedAt && decoded.iat) {
    const changedAtSeconds = Math.floor(user.passwordChangedAt.getTime() / 1000);
    if (decoded.iat < changedAtSeconds) {
      return res.status(401).json({ message: 'Your password was changed. Please sign in again.' });
    }
  }

  // Best-effort, fire-and-forget (not awaited — never adds latency, and a
  // failure here should never fail the request). This is the "are they using
  // the app right now" signal the admin dashboard's "Last active" column
  // needs; lastLoginAt only ever reflects when a session started.
  const staleThreshold = Date.now() - ACTIVITY_UPDATE_THROTTLE_MS;
  if (!user.lastActiveAt || user.lastActiveAt.getTime() < staleThreshold) {
    User.updateOne({ _id: user._id }, { $set: { lastActiveAt: new Date() } }).catch(() => {});
  }

  // Keeps the { id } shape every controller already reads, plus the
  // freshly-loaded role.
  req.user = { id: decoded.id, role: user.role };
  next();
};

module.exports = protect;
