const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Note = require('../models/Note');
const NoteVersion = require('../models/NoteVersion');
const Flashcard = require('../models/Flashcard');
const AdminAuditLog = require('../models/AdminAuditLog');
const HttpError = require('../utils/HttpError');
const { broadcastAdminUpdate } = require('../services/socket');

const ACTIVE_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

const logAction = (req, action, targetUser, targetLabel) =>
  AdminAuditLog.create({ admin: req.user.id, action, targetUser: targetUser || undefined, targetLabel });

// High-level counts for the top of the admin dashboard. "Active" means
// logged in within the last 7 days (User.lastLoginAt, set on every
// password/Google login) — the only signal of real usage this app tracks;
// note-touching activity doesn't update it, since a still-open browser tab
// could silently keep someone "active" forever otherwise.
const getAdminStats = async (req, res) => {
  const activeSince = new Date(Date.now() - ACTIVE_WINDOW_DAYS * DAY_MS);

  const [totalUsers, activeUsers, newUsersThisWeek, totalNotes, totalFlashcards] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ lastLoginAt: { $gte: activeSince } }),
    User.countDocuments({ createdAt: { $gte: activeSince } }),
    Note.countDocuments({}),
    Flashcard.countDocuments({}),
  ]);

  res.status(200).json({ totalUsers, activeUsers, newUsersThisWeek, totalNotes, totalFlashcards });
};

// Per-user breakdown — note/flashcard counts via $lookup+$size rather than N
// separate queries, so this stays one round trip regardless of user count.
const getAdminUsers = async (req, res) => {
  const users = await User.aggregate([
    {
      $lookup: {
        from: 'notes',
        localField: '_id',
        foreignField: 'user',
        as: 'notes',
      },
    },
    {
      $lookup: {
        from: 'flashcards',
        localField: '_id',
        foreignField: 'user',
        as: 'flashcards',
      },
    },
    {
      $project: {
        name: 1,
        email: 1,
        role: 1,
        suspended: 1,
        createdAt: 1,
        lastLoginAt: 1,
        authProvider: { $cond: [{ $ifNull: ['$googleId', false] }, 'google', 'password'] },
        noteCount: { $size: '$notes' },
        flashcardCount: { $size: '$flashcards' },
      },
    },
    { $sort: { createdAt: -1 } },
  ]);

  res.status(200).json(users);
};

// 30-day daily counts for the growth chart — two independent single-series
// results (not one combined dual-axis shape) since signups and notes are
// different-scale measures; the client renders them as two separate charts.
const getGrowth = async (req, res) => {
  const WINDOW_DAYS = 30;
  const since = new Date(Date.now() - WINDOW_DAYS * DAY_MS);
  since.setUTCHours(0, 0, 0, 0);

  const dayBucket = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };

  const [signupRows, noteRows] = await Promise.all([
    User.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: dayBucket, count: { $sum: 1 } } },
    ]),
    Note.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: dayBucket, count: { $sum: 1 } } },
    ]),
  ]);

  const toMap = (rows) => new Map(rows.map((r) => [r._id, r.count]));
  const signupsByDay = toMap(signupRows);
  const notesByDay = toMap(noteRows);

  const days = [];
  for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * DAY_MS);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, signups: signupsByDay.get(key) || 0, notes: notesByDay.get(key) || 0 });
  }

  res.status(200).json(days);
};

const getAuditLog = async (req, res) => {
  const entries = await AdminAuditLog.find({})
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('admin', 'name email');

  res.status(200).json(entries.map((e) => ({
    _id: e._id,
    action: e.action,
    targetLabel: e.targetLabel,
    adminName: e.admin?.name || 'Unknown admin',
    createdAt: e.createdAt,
  })));
};

// Every mutation below refuses to act on req.user's own account — an admin
// changing their own role/suspension/deletion/password through this
// bulk-management surface is exactly how you accidentally lock yourself
// out. Self-suspension and self-deletion already have dedicated, deliberate
// flows (set-admin.js and the Account page's DELETE /auth/account) that this
// doesn't replace.
const guardNotSelf = (req, targetId) => {
  if (targetId === req.user.id) {
    throw new HttpError(400, "You can't perform this action on your own account.");
  }
};

const updateUserRole = async (req, res) => {
  guardNotSelf(req, req.params.id);
  const { role } = req.body;

  const user = await User.findByIdAndUpdate(req.params.id, { role }, { returnDocument: 'after' });
  if (!user) throw new HttpError(404, 'User not found');

  await logAction(req, role === 'admin' ? 'promote' : 'demote', user._id, `${user.name} (${user.email})`);
  broadcastAdminUpdate('admin');
  res.status(200).json({ _id: user._id, role: user.role });
};

const toggleUserSuspension = async (req, res) => {
  guardNotSelf(req, req.params.id);
  const { suspended } = req.body;

  const user = await User.findByIdAndUpdate(req.params.id, { suspended }, { returnDocument: 'after' });
  if (!user) throw new HttpError(404, 'User not found');

  await logAction(req, suspended ? 'suspend' : 'unsuspend', user._id, `${user.name} (${user.email})`);
  broadcastAdminUpdate('admin');
  res.status(200).json({ _id: user._id, suspended: user.suspended });
};

// Returns the new password in plaintext exactly once — same reason no
// password is ever stored or logged anywhere else in this app. The admin is
// expected to relay it to the user through some out-of-band channel; nothing
// here emails it automatically (no email service configured — see README).
const resetUserPassword = async (req, res) => {
  guardNotSelf(req, req.params.id);

  const user = await User.findById(req.params.id);
  if (!user) throw new HttpError(404, 'User not found');

  const tempPassword = crypto.randomBytes(9).toString('base64url');
  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(tempPassword, salt);
  await user.save();

  await logAction(req, 'reset_password', user._id, `${user.name} (${user.email})`);
  broadcastAdminUpdate('admin');
  res.status(200).json({ tempPassword });
};

// Same cascade as the self-service DELETE /auth/account (authController) —
// no password re-confirmation, since admin authority over the *target*
// account is the point, but the client-side ConfirmModal is still the gate
// against a stray click.
const deleteUser = async (req, res) => {
  guardNotSelf(req, req.params.id);

  const user = await User.findById(req.params.id);
  if (!user) throw new HttpError(404, 'User not found');

  const noteIds = await Note.find({ user: user._id }).distinct('_id');
  await NoteVersion.deleteMany({ note: { $in: noteIds } });
  await Flashcard.deleteMany({ user: user._id });
  await Note.deleteMany({ user: user._id });
  await user.deleteOne();

  await logAction(req, 'delete_user', undefined, `${user.name} (${user.email})`);
  broadcastAdminUpdate('admin');
  res.status(200).json({ message: 'User deleted' });
};

const getUserNotes = async (req, res) => {
  const user = await User.findById(req.params.id).select('name email');
  if (!user) throw new HttpError(404, 'User not found');

  const notes = await Note.find({ user: req.params.id })
    .select('title folder tags body createdAt updatedAt')
    .sort({ updatedAt: -1 });

  res.status(200).json({ user: { name: user.name, email: user.email }, notes });
};

// Content moderation — deletes one note regardless of which user owns it
// (admin authority substitutes for the usual note.user === req.user.id
// check every other note-scoped endpoint uses), cascading its version
// history and any flashcards generated from it.
const deleteUserNote = async (req, res) => {
  const note = await Note.findById(req.params.noteId);
  if (!note) throw new HttpError(404, 'Note not found');

  await NoteVersion.deleteMany({ note: note._id });
  await Flashcard.deleteMany({ note: note._id });
  await note.deleteOne();

  await logAction(req, 'delete_note', note.user, `"${note.title}"`);
  broadcastAdminUpdate('admin');
  res.status(200).json({ message: 'Note deleted' });
};

module.exports = {
  getAdminStats,
  getAdminUsers,
  getGrowth,
  getAuditLog,
  updateUserRole,
  toggleUserSuspension,
  resetUserPassword,
  deleteUser,
  getUserNotes,
  deleteUserNote,
};
