const mongoose = require('mongoose');

// A minimal express-rate-limit Store backed by the MongoDB connection this
// app already holds open.
//
// Written by hand rather than pulled from npm on purpose: the obvious
// off-the-shelf choice (rate-limit-mongo) depends on a version of underscore
// carrying an unpatched high-severity DoS advisory with no fix available, and
// adding a known-vulnerable transitive dependency in order to *fix* a
// security problem is a bad trade. The Store contract is three methods.
//
// Why a shared store at all: express-rate-limit's default MemoryStore resets
// on every restart (so brute-force protection is defeated by anyone willing
// to wait out a deploy) and is per-process (so N instances behind a load
// balancer multiply every limit by N).
const COLLECTION = 'rateLimits';

let indexReady = null;
const ensureIndex = () => {
  // TTL index does the cleanup — expired counters are removed by Mongo rather
  // than by any code path here. Created once, lazily, so this module doesn't
  // need the connection to be open at require time.
  if (!indexReady) {
    indexReady = mongoose.connection
      .collection(COLLECTION)
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
      .catch(() => {
        // A failed index build shouldn't break rate limiting; the only cost
        // is that expired documents linger.
        indexReady = null;
      });
  }
  return indexReady;
};

class MongoRateLimitStore {
  constructor(prefix) {
    this.prefix = prefix;
  }

  // express-rate-limit calls this with the limiter's own options.
  init(options) {
    this.windowMs = options.windowMs;
  }

  key(key) {
    return `${this.prefix}:${key}`;
  }

  async increment(key) {
    await ensureIndex();
    const col = mongoose.connection.collection(COLLECTION);
    const now = new Date();
    const _id = this.key(key);

    // Increment only within a still-live window. A document whose expiresAt
    // has passed must start a fresh count rather than continue the old one —
    // matching on expiresAt is what distinguishes the two cases atomically.
    let doc = await col.findOneAndUpdate(
      { _id, expiresAt: { $gt: now } },
      { $inc: { hits: 1 } },
      { returnDocument: 'after' }
    );

    if (!doc) {
      // No live window: either the key is new or its window has expired.
      // Two requests racing here can both reset, which at worst allows one
      // extra request at a window boundary — the standard trade for keeping
      // this to a single round trip.
      const expiresAt = new Date(now.getTime() + this.windowMs);
      doc = await col.findOneAndUpdate(
        { _id },
        { $set: { hits: 1, expiresAt } },
        { upsert: true, returnDocument: 'after' }
      );
    }

    return { totalHits: doc.hits, resetTime: doc.expiresAt };
  }

  async decrement(key) {
    const col = mongoose.connection.collection(COLLECTION);
    await col.updateOne({ _id: this.key(key), hits: { $gt: 0 } }, { $inc: { hits: -1 } });
  }

  async resetKey(key) {
    await mongoose.connection.collection(COLLECTION).deleteOne({ _id: this.key(key) });
  }
}

module.exports = MongoRateLimitStore;
