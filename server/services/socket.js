const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const ADMIN_ROOM = 'admin';
const userRoom = (userId) => `user:${userId}`;

let io = null;

// Any authenticated user (not just admins) can connect — the JWT only
// carries {id}, never role (roles can change after a token was issued), so
// admin-ness is always re-checked fresh from the DB per-connection rather
// than trusted from the token. Runs once per connection (not per event), so
// the extra query is cheap. Every connected user joins their own personal
// room (for targeted notification delivery); admins additionally join the
// shared admin room exactly as before — nothing about the existing
// admin-dashboard live-update feature changes.
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('No token provided'));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('role');
    if (!user) return next(new Error('User not found'));

    socket.data.userId = decoded.id;
    socket.data.isAdmin = user.role === 'admin';
    next();
  } catch {
    next(new Error('Invalid or expired token'));
  }
};

// Attaches Socket.IO to the existing HTTP server (server.js creates it with
// http.createServer(app) specifically so this can share the same port —
// no separate server/port for websocket traffic).
const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((o) => o.trim()),
    },
  });

  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    socket.join(userRoom(socket.data.userId));
    if (socket.data.isAdmin) socket.join(ADMIN_ROOM);
  });

  return io;
};

// Fire-and-forget signal, not a data payload — the client just refetches the
// relevant REST endpoints on receipt. Keeping this as a bare "something of
// this type changed" event (rather than trying to stream computed
// aggregates over the socket) means the dashboard numbers always come from
// the exact same aggregation pipelines as a manual reload would produce, so
// there's no second, parallel copy of that logic to keep in sync.
// No-ops safely if called before initSocket (e.g. from a script) or if the
// event fires but no admin is currently connected — io.to() on an empty
// room is a harmless no-op.
const broadcastAdminUpdate = (type) => {
  io?.to(ADMIN_ROOM).emit('admin:update', { type, at: new Date().toISOString() });
};

// Pushes a notification straight to a specific user's room if they're
// currently connected — a harmless no-op (same io.to()-on-empty-room
// behavior as above) if they're not, since the notification is already
// persisted and they'll see it via GET /api/notifications on next load
// regardless of whether this reaches them live.
const pushNotificationToUser = (userId, notification) => {
  io?.to(userRoom(userId)).emit('notification:new', notification);
};

module.exports = { initSocket, broadcastAdminUpdate, pushNotificationToUser };
