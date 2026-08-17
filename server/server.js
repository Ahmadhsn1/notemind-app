// Bootstrap only — the Express app itself lives in app.js so tests can mount
// it without binding a port or dialling the real database.
const env = require('./config/env');

const http = require('http');
const mongoose = require('mongoose');

const app = require('./app');
const logger = require('./services/logger');
const connectDB = require('./config/db');
const { initSocket, closeSocket } = require('./services/socket');
const { startScheduler, stopScheduler } = require('./services/scheduler');

// Explicit http.Server (rather than app.listen's implicit one) so Socket.IO
// can attach to the same port — no separate websocket port to configure.
const httpServer = http.createServer(app);

// Connect BEFORE listening. Starting the listener first meant requests in the
// connect window sat in Mongoose's command buffer and failed with a buffering
// timeout — surfacing as a 500, not as "the server isn't ready yet".
const start = async () => {
  try {
    await connectDB();
  } catch (err) {
    logger.fatal({ err }, 'Could not connect to MongoDB — exiting');
    process.exit(1);
  }

  initSocket(httpServer);
  startScheduler();

  httpServer.listen(env.PORT, () => {
    logger.info(`Server listening on port ${env.PORT} (${env.NODE_ENV})`);
  });
};

// Platforms send SIGTERM and hard-kill ~10-30s later. Without this, every
// deploy severed in-flight requests mid-response (including streaming /ask
// replies and archiver export downloads) and dropped every Socket.IO client
// without a close frame, which makes them all reconnect-storm the new
// instance at once.
let shuttingDown = false;
const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received — shutting down`);

  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 15000);
  forceExit.unref();

  try {
    stopScheduler();
    await closeSocket();
    await new Promise((resolve) => httpServer.close(resolve));
    await mongoose.connection.close(false);
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Without these, a stray rejection anywhere outside an Express handler (a
// background service, a socket callback) terminated the process on Node 20+
// with no log context at all.
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — shutting down');
  shutdown('uncaughtException');
});

start();
