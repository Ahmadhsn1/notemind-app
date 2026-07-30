const Notification = require('../models/Notification');
const HttpError = require('../utils/HttpError');
const { broadcastAdminUpdate } = require('../services/socket');

// The current user's own inbox — everything they're a recipient of,
// newest first, with a per-item `read` flag derived from readBy rather than
// exposing the raw readBy array (which would leak other recipients' ids).
const getMyNotifications = async (req, res) => {
  const notifications = await Notification.find({ recipients: req.user.id })
    .sort({ createdAt: -1 })
    .select('message createdAt readBy');

  const result = notifications.map((n) => ({
    _id: n._id,
    message: n.message,
    createdAt: n.createdAt,
    read: n.readBy.some((id) => id.toString() === req.user.id),
  }));

  res.status(200).json(result);
};

// Same fetch-then-check ownership pattern every note-scoped endpoint
// already uses (loadOwnedNote) — a user can only mark themselves read on a
// notification they're actually a recipient of. Idempotent ($addToSet).
const markNotificationRead = async (req, res) => {
  const notification = await Notification.findById(req.params.id);
  if (!notification) throw new HttpError(404, 'Notification not found');
  if (!notification.recipients.some((id) => id.toString() === req.user.id)) {
    throw new HttpError(403, 'Not authorized to read this notification');
  }

  await Notification.updateOne(
    { _id: notification._id },
    { $addToSet: { readBy: req.user.id } }
  );

  // Lets the admin dashboard's "Notifications sent" read-counts update live
  // (via the same silent-refetch mechanism every other admin:update already
  // drives) rather than only refreshing on the admin's own next action.
  broadcastAdminUpdate('notification');
  res.status(200).json({ message: 'Marked as read' });
};

module.exports = { getMyNotifications, markNotificationRead };
