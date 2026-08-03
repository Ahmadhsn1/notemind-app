const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Note = require('../models/Note');
const NoteVersion = require('../models/NoteVersion');
const Flashcard = require('../models/Flashcard');
const AdminAuditLog = require('../models/AdminAuditLog');
const Notification = require('../models/Notification');
const HttpError = require('../utils/HttpError');
const { broadcastAdminUpdate, pushNotificationToUser } = require('../services/socket');
const { purgeNotes, purgeUsers } = require('../services/dataCleanup');
const { buildUserNotesExport } = require('../services/noteExport');
const { poolStatus, poolSize } = require('../services/geminiKeyPool');
const { rateLimitConfig } = require('../middleware/rateLimit');

const ACTIVE_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

const logAction = (req, action, targetUser, targetLabel) =>
  AdminAuditLog.create({ admin: req.user.id, action, targetUser: targetUser || undefined, targetLabel });

// High-level counts for the top of the admin dashboard. "Active" means
// genuinely used the app within the last 7 days (User.lastActiveAt, kept
// fresh by middleware/authMiddleware.js's `protect` on every authenticated
// request, throttled to once/minute per user) — falls back to lastLoginAt
// for accounts that haven't made a request since this field was introduced.
const getAdminStats = async (req, res) => {
  const activeSince = new Date(Date.now() - ACTIVE_WINDOW_DAYS * DAY_MS);

  const [totalUsers, activeUsers, newUsersThisWeek, totalNotes, totalFlashcards] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ $or: [{ lastActiveAt: { $gte: activeSince } }, { lastLoginAt: { $gte: activeSince } }] }),
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
        lastActiveAt: 1,
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

  const before = await User.findById(req.params.id).select('role name email');
  if (!before) throw new HttpError(404, 'User not found');
  const beforeRole = before.role;

  const user = await User.findByIdAndUpdate(req.params.id, { role }, { returnDocument: 'after' });

  await AdminAuditLog.create({
    admin: req.user.id,
    action: role === 'admin' ? 'promote' : 'demote',
    targetUser: user._id,
    targetLabel: `${user.name} (${user.email})`,
    before: { role: beforeRole },
    after: { role: user.role },
  });
  broadcastAdminUpdate('admin');
  res.status(200).json({ _id: user._id, role: user.role });
};

const toggleUserSuspension = async (req, res) => {
  guardNotSelf(req, req.params.id);
  const { suspended } = req.body;

  const before = await User.findById(req.params.id).select('suspended name email');
  if (!before) throw new HttpError(404, 'User not found');
  const beforeSuspended = before.suspended;

  const user = await User.findByIdAndUpdate(req.params.id, { suspended }, { returnDocument: 'after' });

  await AdminAuditLog.create({
    admin: req.user.id,
    action: suspended ? 'suspend' : 'unsuspend',
    targetUser: user._id,
    targetLabel: `${user.name} (${user.email})`,
    before: { suspended: beforeSuspended },
    after: { suspended: user.suspended },
  });
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

  await purgeUsers([user._id]);
  await user.deleteOne();

  await logAction(req, 'delete_user', undefined, `${user.name} (${user.email})`);
  broadcastAdminUpdate('admin');
  res.status(200).json({ message: 'User deleted' });
};

const getUserNotes = async (req, res) => {
  const user = await User.findById(req.params.id).select('name email');
  if (!user) throw new HttpError(404, 'User not found');

  // Full lifecycle/content projection for the Content-tab moderation UI —
  // never selects embedding (large, irrelevant to admin).
  const notes = await Note.find({ user: req.params.id })
    .select('title folder tags body contentHtml pinned reminderAt archivedAt deletedAt createdAt updatedAt aiSummary links')
    .sort({ updatedAt: -1 });

  res.status(200).json({ user: { name: user.name, email: user.email }, notes });
};

// Single note detail for the admin note-viewer modal — unaudited read, same
// convention as getUserNotes/getAdminUsers.
const getNoteDetail = async (req, res) => {
  const note = await Note.findById(req.params.noteId).select('-embedding').populate('user', 'name email');
  if (!note) throw new HttpError(404, 'Note not found');
  res.status(200).json(note);
};

// Content moderation — deletes one note regardless of which user owns it
// (admin authority substitutes for the usual note.user === req.user.id
// check every other note-scoped endpoint uses), cascading its version
// history and any flashcards generated from it.
const deleteUserNote = async (req, res) => {
  const note = await Note.findById(req.params.noteId);
  if (!note) throw new HttpError(404, 'Note not found');

  await purgeNotes([note._id]);

  await logAction(req, 'delete_note', note.user, `"${note.title}"`);
  broadcastAdminUpdate('admin');
  res.status(200).json({ message: 'Note deleted' });
};

// Lifecycle moderation on a user's note — mirrors the update shapes
// noteController.js's own archive/unarchive/deleteNote(trash)/restoreNote use
// for the owner-facing routes, just without the ownership check (admin
// authority substitutes for it, same as deleteUserNote above). Admin never
// *sets* pinned=true on a user's behalf (that's curation, not moderation),
// only unpins.
const archiveUserNote = async (req, res) => {
  // Archived and trashed are mutually exclusive (models/Note.js). Scoping the
  // update to `deletedAt: null` is what enforces that here — without it,
  // archiving an already-trashed note set both fields and the note fell out
  // of every view except Trash, where the 30-day purge then destroyed it.
  // Mirrors the same guard in noteController.archiveNote.
  const note = await Note.findOneAndUpdate(
    { _id: req.params.noteId, deletedAt: null },
    { archivedAt: new Date(), pinned: false },
    { returnDocument: 'after' }
  );
  if (!note) {
    const exists = await Note.exists({ _id: req.params.noteId });
    throw exists
      ? new HttpError(400, 'Restore the note from trash before archiving it')
      : new HttpError(404, 'Note not found');
  }
  await logAction(req, 'archive_note', note.user, `"${note.title}"`);
  broadcastAdminUpdate('admin');
  res.status(200).json(note);
};

const unarchiveUserNote = async (req, res) => {
  const note = await Note.findByIdAndUpdate(req.params.noteId, { archivedAt: null }, { returnDocument: 'after' });
  if (!note) throw new HttpError(404, 'Note not found');
  await logAction(req, 'unarchive_note', note.user, `"${note.title}"`);
  broadcastAdminUpdate('admin');
  res.status(200).json(note);
};

const trashUserNote = async (req, res) => {
  const note = await Note.findByIdAndUpdate(
    req.params.noteId,
    { deletedAt: new Date(), archivedAt: null, pinned: false },
    { returnDocument: 'after' }
  );
  if (!note) throw new HttpError(404, 'Note not found');
  await logAction(req, 'trash_note', note.user, `"${note.title}"`);
  broadcastAdminUpdate('admin');
  res.status(200).json(note);
};

const restoreUserNote = async (req, res) => {
  const note = await Note.findByIdAndUpdate(req.params.noteId, { deletedAt: null }, { returnDocument: 'after' });
  if (!note) throw new HttpError(404, 'Note not found');
  await logAction(req, 'restore_note', note.user, `"${note.title}"`);
  broadcastAdminUpdate('admin');
  res.status(200).json(note);
};

const unpinUserNote = async (req, res) => {
  const note = await Note.findByIdAndUpdate(req.params.noteId, { pinned: false }, { returnDocument: 'after' });
  if (!note) throw new HttpError(404, 'Note not found');
  await logAction(req, 'unpin_note', note.user, `"${note.title}"`);
  broadcastAdminUpdate('admin');
  res.status(200).json(note);
};

// Read-only version history for the admin note-viewer — deliberately no
// restore endpoint here (unlike the owner-facing restoreNoteVersion): admin
// can see history but never rewrites a user's note content.
const getUserNoteVersions = async (req, res) => {
  const versions = await NoteVersion.find({ note: req.params.noteId })
    .sort({ createdAt: -1 })
    .select('title contentHtml body createdAt');
  res.status(200).json(versions);
};

// Flashcard visibility — admin previously only saw a per-user count
// (getAdminUsers' flashcardCount); this exposes actual Q&A + SM-2 state.
const getUserFlashcards = async (req, res) => {
  const user = await User.findById(req.params.id).select('name email');
  if (!user) throw new HttpError(404, 'User not found');

  const flashcards = await Flashcard.find({ user: req.params.id })
    .populate('note', 'title folder')
    .sort({ dueDate: 1 });

  res.status(200).json({ user: { name: user.name, email: user.email }, flashcards });
};

const getNoteFlashcardsAdmin = async (req, res) => {
  const flashcards = await Flashcard.find({ note: req.params.noteId }).sort({ dueDate: 1 });
  res.status(200).json(flashcards);
};

const deleteUserFlashcard = async (req, res) => {
  const flashcard = await Flashcard.findById(req.params.flashcardId);
  if (!flashcard) throw new HttpError(404, 'Flashcard not found');

  await flashcard.deleteOne();

  await logAction(req, 'delete_flashcard', flashcard.user, `"${flashcard.question.slice(0, 60)}"`);
  broadcastAdminUpdate('admin');
  res.status(200).json({ message: 'Flashcard deleted' });
};

// Per-user data export on the admin's behalf (support/GDPR-style requests) —
// delegates to the same service the self-service /notes/export/* routes use,
// just scoped to an admin-specified userId instead of req.user.id. This is
// the one read-type admin action that IS audited (unlike getUserNotes/
// getUserFlashcards/getNoteDetail/getUserNoteVersions above), since it's a
// bulk data-extraction action, not a single-record view. Logged before the
// stream starts since there's no single post-stream "success" point to hook.
const exportUserDataJson = async (req, res) => {
  const user = await User.findById(req.params.id).select('name email');
  if (!user) throw new HttpError(404, 'User not found');
  await logAction(req, 'export_user_data', user._id, `${user.name} (${user.email}) — JSON`);
  await buildUserNotesExport(req.params.id, 'json', res);
};

const exportUserDataMarkdown = async (req, res) => {
  const user = await User.findById(req.params.id).select('name email');
  if (!user) throw new HttpError(404, 'User not found');
  await logAction(req, 'export_user_data', user._id, `${user.name} (${user.email}) — Markdown`);
  await buildUserNotesExport(req.params.id, 'markdown', res);
};

// One endpoint for every bulk operation (rather than 4 separate bulk routes)
// so there's a single place enforcing the self-guard against the whole
// batch. Writes ONE audit-log entry summarizing the batch, not one per user
// — keeps the log readable for a 50-user bulk action.
const bulkUserAction = async (req, res) => {
  const { userIds, action } = req.body;
  if (userIds.includes(req.user.id)) {
    throw new HttpError(400, "You can't include your own account in a bulk action.");
  }

  const users = await User.find({ _id: { $in: userIds } }).select('name email');
  if (users.length === 0) throw new HttpError(404, 'No matching users found');

  const labels = users.map((u) => `${u.name} (${u.email})`);
  const summaryLabel = `${users.length} user${users.length === 1 ? '' : 's'}: ${labels.slice(0, 5).join(', ')}${labels.length > 5 ? `, +${labels.length - 5} more` : ''}`;

  switch (action) {
    case 'suspend':
      await User.updateMany({ _id: { $in: userIds } }, { suspended: true });
      await logAction(req, 'bulk_suspend', undefined, summaryLabel);
      break;
    case 'unsuspend':
      await User.updateMany({ _id: { $in: userIds } }, { suspended: false });
      await logAction(req, 'bulk_unsuspend', undefined, summaryLabel);
      break;
    case 'role_user':
    case 'role_admin': {
      const role = action === 'role_admin' ? 'admin' : 'user';
      await User.updateMany({ _id: { $in: userIds } }, { role });
      await logAction(req, 'bulk_role_change', undefined, `${summaryLabel} → ${role}`);
      break;
    }
    case 'delete': {
      await purgeUsers(userIds);
      await User.deleteMany({ _id: { $in: userIds } });
      await logAction(req, 'bulk_delete_user', undefined, summaryLabel);
      break;
    }
    default:
      throw new HttpError(400, 'Unknown bulk action');
  }

  broadcastAdminUpdate('admin');
  res.status(200).json({ affected: users.length });
};

// Operational visibility — Gemini key-pool health (poolStatus() already
// existed in services/geminiKeyPool.js but was never consumed anywhere) and
// rate-limit config. Rate limits are STATIC config only: express-rate-limit
// doesn't expose a stable public API to read live per-IP/per-key hit counts
// back out of its in-memory store, so this deliberately does not attempt to
// show "requests remaining" — that would have to be faked. Unaudited read.
const getSystemStatus = async (req, res) => {
  res.status(200).json({
    geminiPool: { size: poolSize, keys: poolStatus() },
    rateLimits: rateLimitConfig,
  });
};

// Recipients are resolved to a concrete list of user ids right now (not
// stored as a dynamic "all users" flag) — see Notification.js's comment on
// why: a broadcast shouldn't retroactively reach someone who signs up
// afterward. Pushes live to anyone currently connected (services/socket.js's
// pushNotificationToUser, a harmless no-op for anyone not connected — they
// still see it via GET /api/notifications on their next load regardless).
const sendNotification = async (req, res) => {
  const { message, targetType, userIds } = req.body;

  let recipientUsers;
  if (targetType === 'all') {
    recipientUsers = await User.find({}).select('name email');
  } else {
    recipientUsers = await User.find({ _id: { $in: userIds } }).select('name email');
    if (recipientUsers.length !== userIds.length) {
      throw new HttpError(400, 'One or more selected users do not exist');
    }
  }

  const notification = await Notification.create({
    message,
    createdBy: req.user.id,
    recipients: recipientUsers.map((u) => u._id),
  });

  for (const u of recipientUsers) {
    pushNotificationToUser(u._id.toString(), {
      _id: notification._id,
      message: notification.message,
      createdAt: notification.createdAt,
      read: false,
    });
  }

  const label = targetType === 'single'
    ? `${recipientUsers[0].name} (${recipientUsers[0].email})`
    : `${targetType === 'all' ? 'all users' : 'selected users'} (${recipientUsers.length})`;
  await logAction(req, 'send_notification', targetType === 'single' ? recipientUsers[0]._id : undefined, label);
  broadcastAdminUpdate('notification');

  res.status(201).json(notification);
};

// Recent sends with a per-recipient read breakdown, so the admin can see
// exactly who has (and hasn't) seen a given notification, not just an
// aggregate count.
const getAdminNotifications = async (req, res) => {
  const notifications = await Notification.find({})
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('recipients', 'name email')
    .populate('createdBy', 'name email');

  const result = notifications.map((n) => {
    const readSet = new Set(n.readBy.map((id) => id.toString()));
    const recipients = n.recipients.map((r) => ({
      _id: r._id,
      name: r.name,
      email: r.email,
      read: readSet.has(r._id.toString()),
    }));
    return {
      _id: n._id,
      message: n.message,
      createdAt: n.createdAt,
      createdBy: n.createdBy ? { name: n.createdBy.name, email: n.createdBy.email } : null,
      recipients,
      readCount: recipients.filter((r) => r.read).length,
      totalRecipients: recipients.length,
    };
  });

  res.status(200).json(result);
};

// Retracts a sent notification entirely (removed from every recipient's
// inbox, not just hidden from the admin list).
const deleteNotification = async (req, res) => {
  const notification = await Notification.findById(req.params.id);
  if (!notification) throw new HttpError(404, 'Notification not found');

  await notification.deleteOne();

  await logAction(req, 'delete_notification', undefined, `"${notification.message.slice(0, 60)}"`);
  broadcastAdminUpdate('notification');
  res.status(200).json({ message: 'Notification deleted' });
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
  getNoteDetail,
  deleteUserNote,
  archiveUserNote,
  unarchiveUserNote,
  trashUserNote,
  restoreUserNote,
  unpinUserNote,
  getUserNoteVersions,
  getUserFlashcards,
  getNoteFlashcardsAdmin,
  deleteUserFlashcard,
  exportUserDataJson,
  exportUserDataMarkdown,
  bulkUserAction,
  getSystemStatus,
  sendNotification,
  getAdminNotifications,
  deleteNotification,
};
