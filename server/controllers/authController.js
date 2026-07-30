const User = require('../models/User');
const Note = require('../models/Note');
const NoteVersion = require('../models/NoteVersion');
const Flashcard = require('../models/Flashcard');
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
// replayed here. First sign-in for a given Google account either links to an
// existing password-based account with the same (Google-verified, so
// trusted) email, or creates a fresh account with no password — see
// User.password being optional.
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

  let user = await User.findOne({ $or: [{ googleId: payload.sub }, { email: payload.email }] });
  if (!user) {
    user = await User.create({ name: payload.name || payload.email, email: payload.email, googleId: payload.sub });
  } else if (!user.googleId) {
    user.googleId = payload.sub;
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
  const user = await User.findById(req.user.id).select('-password');
  if (!user) throw new HttpError(404, 'User not found');

  res.status(200).json({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    hasPassword: !!user.password,
  });
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

// Full self-service account wipe — cascades through every collection scoped
// to this user (NoteVersion is scoped via note, not user, directly) so
// deleting an account doesn't leave orphaned data behind. Password
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

  const noteIds = await Note.find({ user: user._id }).distinct('_id');
  await NoteVersion.deleteMany({ note: { $in: noteIds } });
  await Flashcard.deleteMany({ user: user._id });
  await Note.deleteMany({ user: user._id });
  await user.deleteOne();

  broadcastAdminUpdate('user');
  res.status(200).json({ message: 'Account deleted' });
};

module.exports = { registerUser, loginUser, googleAuth, getMe, updateProfile, changePassword, deleteAccount };
