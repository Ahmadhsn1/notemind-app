const crypto = require('crypto');
const User = require('../models/User');
const PasswordResetToken = require('../models/PasswordResetToken');
const { purgeUsers } = require('../services/dataCleanup');
// Imported as a namespace, not destructured: destructuring binds the original
// function at require time, so a test that stubs the module's export would be
// bypassed entirely and every reset test would try to hit the real provider.
const emailService = require('../services/email');
const logger = require('../services/logger');
const env = require('../config/env');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const HttpError = require('../utils/HttpError');
const { broadcastAdminUpdate } = require('../services/socket');

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// { _id, name, email, role, token } — the exact shape every auth entrypoint
// (register/login/google) responds with, so AuthContext.login() always gets
// the same fields regardless of which path issued the session.
const authPayload = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  token: generateToken(user._id),
});

const registerUser = async (req, res) => {
  const { name, email, password } = req.body;

  const userExists = await User.findOne({ email });
  if (userExists) {
    throw new HttpError(400, 'User already exists');
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const user = await User.create({
    name,
    email,
    password: hashedPassword,
  });

  broadcastAdminUpdate('user');
  res.status(201).json(authPayload(user));
};

const loginUser = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  // No user, or an account that only has a Google credential (no password to
  // check against) — same generic message either way so a login attempt
  // can't be used to enumerate which accounts exist or how they authenticate.
  if (!user || !user.password) {
    throw new HttpError(400, 'Invalid email or password');
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new HttpError(400, 'Invalid email or password');
  }

  if (user.suspended) {
    throw new HttpError(403, 'This account has been suspended.');
  }

  user.lastLoginAt = new Date();
  await user.save();

  broadcastAdminUpdate('user');
  res.status(200).json(authPayload(user));
};

// Google Identity Services returns a signed ID token (JWT) to the client,
// which forwards it here as `credential` — verified against Google's own
// keys (google-auth-library fetches/caches those) with this app's client id
// as the required audience, so a token minted for some other app can't be
// replayed here. First sign-in for a given Google account creates a fresh
// account with no password (see User.password being optional); it does NOT
// adopt an existing account that merely shares the email — see the linking
// comment below for why.
const googleAuth = async (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new HttpError(501, 'Google sign-in is not configured on this server');
  }

  const { credential } = req.body;
  const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch {
    throw new HttpError(401, 'Invalid Google credential');
  }

  if (!payload.email_verified) {
    throw new HttpError(401, 'Google account email is not verified');
  }

  // Match on googleId ONLY — never fall back to matching by email.
  //
  // This used to be `$or: [{ googleId }, { email }]`, which auto-linked an
  // incoming Google identity to any existing account sharing its email. Since
  // updateProfile lets any user set their address to any not-currently-in-use
  // email, and nothing in this app verifies email ownership, that was a
  // pre-hijacking hole: an attacker registers with a password, changes their
  // address to victim@gmail.com before the victim signs up, and the victim's
  // first Google sign-in silently lands them inside the attacker's account —
  // which the attacker still has the password to.
  //
  // A brand-new email is still safe to auto-provision (nobody else can claim
  // an account that doesn't exist). An email that already belongs to an
  // account has to be linked from inside an authenticated session instead,
  // which proves ownership.
  let user = await User.findOne({ googleId: payload.sub });

  if (!user) {
    const emailOwner = await User.findOne({ email: payload.email });
    if (emailOwner) {
      throw new HttpError(
        409,
        'An account with this email already exists. Sign in with your password, then connect Google from your account settings.'
      );
    }
    user = await User.create({ name: payload.name || payload.email, email: payload.email, googleId: payload.sub });
  }

  if (user.suspended) {
    throw new HttpError(403, 'This account has been suspended.');
  }

  user.lastLoginAt = new Date();
  await user.save();

  broadcastAdminUpdate('user');
  res.status(200).json(authPayload(user));
};

const getMe = async (req, res) => {
  // Deliberately NOT .select('-password'): the response below is hand-built
  // field by field, so the hash can never leak — but excluding it from the
  // query made `hasPassword` compute from an always-undefined value and so
  // report false for every account, including password ones.
  //
  // That silently broke self-service account deletion: pages/Account.jsx only
  // renders the password-confirmation input when hasPassword !== false, so it
  // never rendered, the client posted an empty password, and deleteAccount's
  // bcrypt check rejected it with "Password is incorrect" — for every user,
  // with no way to proceed.
  const user = await User.findById(req.user.id);
  if (!user) throw new HttpError(404, 'User not found');

  res.status(200).json({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    hasPassword: !!user.password,
    hasGoogle: !!user.googleId,
  });
};

const RESET_TOKEN_TTL_MINUTES = 60;

const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// Always responds with the same success message, whether or not the address
// belongs to an account. Confirming "no account with that email" would turn
// this endpoint into an account-existence oracle that anyone can query — the
// same reason loginUser returns one generic message for both a missing user
// and a wrong password.
const FORGOT_PASSWORD_RESPONSE = {
  message: 'If an account exists for that email, a reset link is on its way.',
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  // A Google-only account has no password to reset; sending a link would let
  // someone add a password to an account they merely know the address of.
  if (!user || !user.password) {
    return res.status(200).json(FORGOT_PASSWORD_RESPONSE);
  }

  // One live token per user: requesting a new link must invalidate the
  // previous one, or every link ever emailed stays redeemable until it
  // expires.
  await PasswordResetToken.deleteMany({ user: user._id });

  const token = crypto.randomBytes(32).toString('base64url');
  await PasswordResetToken.create({
    user: user._id,
    tokenHash: hashResetToken(token),
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000),
  });

  const resetUrl = `${env.allowedOrigins[0]}/reset-password?token=${token}`;
  const { subject, html, text } = emailService.passwordResetEmail(user.name, resetUrl, RESET_TOKEN_TTL_MINUTES);

  try {
    await emailService.sendEmail({ to: user.email, subject, html, text });
  } catch (err) {
    // Deliberately swallowed: a provider outage must not change the response
    // shape, or the difference between "sent" and "failed" becomes the same
    // existence oracle this endpoint exists to avoid.
    logger.error({ err }, 'Password reset email failed to send');
  }

  res.status(200).json(FORGOT_PASSWORD_RESPONSE);
};

const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  const record = await PasswordResetToken.findOne({ tokenHash: hashResetToken(token) });
  if (!record || record.expiresAt < new Date()) {
    // Same message either way — a distinct "expired" response would confirm
    // the token was genuine, which is useful to an attacker who found one.
    throw new HttpError(400, 'This reset link is invalid or has expired. Request a new one.');
  }

  const user = await User.findById(record.user);
  if (!user) {
    await PasswordResetToken.deleteMany({ user: record.user });
    throw new HttpError(400, 'This reset link is invalid or has expired. Request a new one.');
  }

  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(newPassword, salt);
  // Invalidates every session issued before this moment — see
  // middleware/authMiddleware. Whoever forced the reset (or whoever the user
  // was locked out by) is signed out everywhere, which is the whole point of
  // resetting a password you believe is compromised.
  user.passwordChangedAt = new Date();
  await user.save();

  // Single use: the token is consumed whether or not anything else follows.
  await PasswordResetToken.deleteMany({ user: user._id });

  res.status(200).json({ message: 'Password updated. You can now sign in.' });
};

// Verifies a Google credential and attaches it to the CURRENT session's user.
//
// This is the counterpart to googleAuth's refusal to auto-link by email. That
// refusal exists because updateProfile lets anyone claim any unregistered
// address with no verification, so matching an incoming Google identity to an
// existing account by email alone let an attacker pre-claim victim@gmail.com
// and capture the victim's first Google sign-in. Linking from inside an
// authenticated session is what proves the account is actually yours.
const linkGoogle = async (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new HttpError(501, 'Google sign-in is not configured on this server');
  }

  const { credential } = req.body;
  const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch {
    throw new HttpError(401, 'Invalid Google credential');
  }

  if (!payload.email_verified) {
    throw new HttpError(401, 'Google account email is not verified');
  }

  // googleId is a unique index; catching this here gives a real explanation
  // instead of a duplicate-key 409 from the write below.
  const claimedBy = await User.findOne({ googleId: payload.sub });
  if (claimedBy && claimedBy._id.toString() !== req.user.id) {
    throw new HttpError(409, 'That Google account is already linked to a different NoteMind account');
  }

  const user = await User.findById(req.user.id);
  if (!user) throw new HttpError(404, 'User not found');

  user.googleId = payload.sub;
  await user.save();

  res.status(200).json({ hasGoogle: true, googleEmail: payload.email });
};

// Unlinking is only safe when a password remains — otherwise the account
// would have no way to authenticate at all and would be permanently
// unreachable (there is no email-based recovery in this app).
const unlinkGoogle = async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new HttpError(404, 'User not found');
  if (!user.googleId) throw new HttpError(400, 'This account is not linked to Google');
  if (!user.password) {
    throw new HttpError(400, 'Set a password before unlinking Google, or you would be locked out of this account');
  }

  user.googleId = undefined;
  await user.save();

  res.status(200).json({ hasGoogle: false });
};

const updateProfile = async (req, res) => {
  const { name, email } = req.body;

  const emailTaken = await User.findOne({ email, _id: { $ne: req.user.id } });
  if (emailTaken) throw new HttpError(400, 'That email is already in use');

  const user = await User.findById(req.user.id);
  if (!user) throw new HttpError(404, 'User not found');

  user.name = name;
  user.email = email;
  await user.save();

  broadcastAdminUpdate('user');

  res.status(200).json({ _id: user._id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt });
};

const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user.id);
  if (!user) throw new HttpError(404, 'User not found');
  if (!user.password) throw new HttpError(400, 'This account signs in with Google and has no password to change');

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) throw new HttpError(400, 'Current password is incorrect');

  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(newPassword, salt);
  await user.save();

  res.status(200).json({ message: 'Password updated' });
};

// Full self-service account wipe. The cascade itself lives in
// services/dataCleanup.purgeUsers, shared with the two admin delete paths, so
// all three stay identical — they previously diverged and none of them
// cleaned up Resurface history, notification references, or uploaded images,
// which made "delete my account" leave real personal data behind. Password
// re-confirmation guards against a hijacked/left-open session doing this by
// accident, same idea as GitHub/similar "type your password" account
// deletion flows — Google-only accounts have no password to re-check, so the
// confirm dialog (client-side) is their only gate.
const deleteAccount = async (req, res) => {
  const { password } = req.body;

  const user = await User.findById(req.user.id);
  if (!user) throw new HttpError(404, 'User not found');

  if (user.password) {
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new HttpError(400, 'Password is incorrect');
  }

  await purgeUsers([user._id]);
  await user.deleteOne();

  broadcastAdminUpdate('user');
  res.status(200).json({ message: 'Account deleted' });
};

module.exports = {
  registerUser,
  loginUser,
  googleAuth,
  getMe,
  updateProfile,
  changePassword,
  deleteAccount,
  linkGoogle,
  unlinkGoogle,
  forgotPassword,
  resetPassword,
};
