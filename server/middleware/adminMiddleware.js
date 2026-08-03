const HttpError = require('../utils/HttpError');

// Runs after `protect`, which now loads the user on every authenticated
// request (to enforce account-exists/not-suspended) and attaches the role it
// read. Roles can change after a token is issued — the JWT carries only
// { id }, never a role — so this still never trusts the token; it just reuses
// the lookup `protect` already performed instead of issuing a second
// identical query per admin request.
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    throw new HttpError(403, 'Admin access required');
  }
  next();
};

module.exports = requireAdmin;
