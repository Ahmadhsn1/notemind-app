const jwt = require('jsonwebtoken');
const User = require('../models/User');

// How often a given user's lastActiveAt actually gets written — most
// requests within this window match zero documents (cheap indexed _id
// lookup, not a real write), so this stays a single-digit-ms check on every
// authenticated request rather than a write storm.
const ACTIVITY_UPDATE_THROTTLE_MS = 60 * 1000;

const protect = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided, access denied' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    // Best-effort, fire-and-forget (not awaited — never adds latency to the
    // request, and a failure here should never fail the request itself).
    // This is the actual "are they using the app right now" signal the
    // admin dashboard's "Last active" column needs — lastLoginAt alone only
    // ever reflects the moment a session started, not whether it's still
    // genuinely being used.
    const staleThreshold = new Date(Date.now() - ACTIVITY_UPDATE_THROTTLE_MS);
    User.updateOne(
      { _id: decoded.id, $or: [{ lastActiveAt: null }, { lastActiveAt: { $lt: staleThreshold } }] },
      { $set: { lastActiveAt: new Date() } }
    ).catch(() => {});

    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

module.exports = protect;
