const mongoose = require('mongoose');
const env = require('./env');
const logger = require('../services/logger');

// Options matter more than they look. With none of these set:
//   - autoIndex defaulted to true, so every boot re-attempted index builds
//     (including the {title,body,tags} text index on Note) against the
//     primary — fine on 50 notes, a startup stall and a production incident
//     later on.
//   - serverSelectionTimeoutMS defaulted to 30s with command buffering on, so
//     a brief network blip meant requests *hung* for 30 seconds instead of
//     failing fast, filling the event loop until the instance stopped
//     responding at all.
const connectOptions = {
  serverSelectionTimeoutMS: 8000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
  maxPoolSize: 10,
  minPoolSize: 1,
  // Indexes are declared in the models but building them is a deploy-time
  // operation, not a per-boot one. Run scripts/sync-indexes.js after a schema
  // change instead.
  autoIndex: !env.isProduction,
};

const connectDB = async () => {
  // Post-boot connection loss was previously invisible — no handler, no log.
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));
  mongoose.connection.on('error', (err) => logger.error({ err }, 'MongoDB connection error'));

  await mongoose.connect(env.MONGO_URI, connectOptions);
  logger.info('MongoDB connected');
};

module.exports = connectDB;
