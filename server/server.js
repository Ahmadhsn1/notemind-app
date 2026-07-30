const crypto = require('crypto');
global.crypto = crypto;

require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const noteRoutes = require('./routes/noteRoutes');
const flashcardRoutes = require('./routes/flashcardRoutes');
const adminRoutes = require('./routes/adminRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { uploadsDir } = require('./services/uploadStorage');
const { initSocket } = require('./services/socket');

connectDB();

const app = express();

app.use(helmet());
// Comma-separated list so a deployed client can be added without a code
// change; falls back to the Vite dev server origin if unset.
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim());
// Content-Disposition isn't on the CORS-safelisted response header list, so
// without this the export downloads' filenames are invisible to client JS
// (fetch() can still read the body, just not this header) across the
// client/API origin split.
app.use(cors({ origin: allowedOrigins, exposedHeaders: ['Content-Disposition'] }));
app.use(express.json({ limit: '1mb' }));

// helmet()'s default Cross-Origin-Resource-Policy is same-origin, which
// would silently block the client (a different origin — see api/axios.js)
// from ever loading these <img> tags even with a correct URL. Scoped to just
// this static route rather than loosened globally.
app.use('/uploads', express.static(uploadsDir, {
  setHeaders: (res) => res.set('Cross-Origin-Resource-Policy', 'cross-origin'),
}));

app.use('/api/auth', authRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/flashcards', flashcardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Explicit http.Server (rather than app.listen's implicit one) so Socket.IO
// can attach to the same port — no separate websocket port to configure.
const httpServer = http.createServer(app);
initSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
