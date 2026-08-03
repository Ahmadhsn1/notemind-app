const crypto = require('crypto');
const env = require('../config/env');

// Short-lived, per-file HMAC signatures for note image URLs.
//
// The problem this solves: <img src> cannot carry an Authorization header,
// and this app authenticates with a bearer token rather than a cookie, so
// /uploads could not simply be put behind `protect` — doing that breaks every
// image in every note. The previous state was therefore "anyone who ever sees
// the URL can fetch that image forever", with the owner's user id sitting in
// the filename.
//
// Signing each filename individually (rather than minting one token that
// unlocks all of a user's images) keeps the blast radius of a leaked URL to
// exactly what it was before — one image — while adding an expiry it never
// had. A URL copied out of a browser history, a referrer header or a shared
// screenshot stops working within the hour.
//
// The key is derived from JWT_SECRET rather than reusing it directly, so an
// image signature can never be confused for, or used to forge, a session
// token.
const SIGNING_KEY = crypto.createHmac('sha256', env.JWT_SECRET).update('notemind:image-url:v1').digest();

const DEFAULT_TTL_SECONDS = 60 * 60;

const computeSignature = (filename, expiresAt) =>
  crypto.createHmac('sha256', SIGNING_KEY).update(`${filename}:${expiresAt}`).digest('base64url');

const signFilename = (filename, ttlSeconds = DEFAULT_TTL_SECONDS) => {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  return { exp: expiresAt, sig: computeSignature(filename, expiresAt) };
};

const verifySignature = (filename, exp, sig) => {
  const expiresAt = Number(exp);
  if (!Number.isInteger(expiresAt) || typeof sig !== 'string' || sig.length === 0) return false;
  if (expiresAt < Math.floor(Date.now() / 1000)) return false;

  const expected = computeSignature(filename, expiresAt);
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  // Length check first: timingSafeEqual throws on a length mismatch, and
  // comparing with === would leak how much of the signature was correct.
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

// The owner's id is the filename prefix (see noteController.uploadImage's
// `${userId}-${uuid}.${ext}`), which is what lets the signing endpoint refuse
// to sign someone else's file without a database lookup per image.
const ownerIdOf = (filename) => filename.split('-')[0];

module.exports = { signFilename, verifySignature, ownerIdOf, DEFAULT_TTL_SECONDS };
