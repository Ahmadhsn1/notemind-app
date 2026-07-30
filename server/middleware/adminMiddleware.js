const User = require('../models/User');
const HttpError = require('../utils/HttpError');

// Runs after `protect` — the JWT only carries { id }, not role (roles can
// change after a token was issued, so it's looked up fresh rather than
// trusted from the token). Admin routes are low-traffic, so the extra query
// per request is a non-issue.
const requireAdmin = async (req, res, next) => {
  const user = await User.findById(req.user.id).select('role');
  if (!user || user.role !== 'admin') {
    throw new HttpError(403, 'Admin access required');
  }
  next();
};

module.exports = requireAdmin;
