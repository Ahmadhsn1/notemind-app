const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const express = require('express');
const { S3Client, PutObjectCommand, DeleteObjectsCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const env = require('../config/env');
const logger = require('./logger');
const { verifySignature } = require('./imageSignature');
const HttpError = require('../utils/HttpError');

// Two interchangeable backends behind one interface.
//
// Local disk was the only option before, and on any container platform that
// filesystem is wiped on every deploy, restart and scale event — while notes
// permanently store the /uploads/<file> path in their HTML. The result was
// that every image every user had ever pasted turned into a broken <img>
// after the first redeploy, with no error and no recovery. R2 is therefore
// mandatory in production (enforced in config/env.js); local disk stays as
// the zero-setup path for development.
const uploadsDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const s3 = env.r2Configured
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    })
  : null;

logger.info(`Upload storage: ${s3 ? `Cloudflare R2 (${env.R2_BUCKET})` : 'local disk (development only)'}`);

// Notes keep storing the relative /uploads/... path regardless of backend, so
// switching backends (or migrating existing files) never requires rewriting
// stored note HTML.
const urlFor = (filename) => `/uploads/${filename}`;

// Every filename this app generates is `${userId}-${uuid}.${ext}`
// (noteController.uploadImage), and the cleanup paths derive theirs by regex
// from stored HTML — so anything containing a separator is a bug or an
// attack, never legitimate.
const isSafeFilename = (filename) =>
  typeof filename === 'string' &&
  filename.length > 0 &&
  !filename.includes('/') &&
  !filename.includes('\\') &&
  !filename.includes('..');


const CONTENT_TYPES = { png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };
const contentTypeFor = (filename) => CONTENT_TYPES[filename.split('.').pop()?.toLowerCase()] || 'application/octet-stream';

const writeFile = async (filename, buffer) => {
  if (!isSafeFilename(filename)) throw new Error(`Unsafe upload filename: ${filename}`);

  if (s3) {
    await s3.send(new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: filename,
      Body: buffer,
      ContentType: contentTypeFor(filename),
    }));
  } else {
    await fsp.writeFile(path.join(uploadsDir, filename), buffer);
  }

  return urlFor(filename);
};

// Best-effort by design: a file that's already gone (or was never written
// because an earlier deploy wiped the disk) must not fail the delete that
// triggered it. Returns how many were actually removed, for logging.
const deleteFiles = async (filenames) => {
  const safe = filenames.filter(isSafeFilename);
  if (safe.length === 0) return 0;

  if (s3) {
    try {
      // One batched call rather than N round trips.
      const res = await s3.send(new DeleteObjectsCommand({
        Bucket: env.R2_BUCKET,
        Delete: { Objects: safe.map((Key) => ({ Key })), Quiet: true },
      }));
      return safe.length - (res.Errors?.length || 0);
    } catch (err) {
      logger.warn({ err }, 'R2 batch delete failed');
      return 0;
    }
  }

  let removed = 0;
  for (const filename of safe) {
    try {
      await fsp.unlink(path.join(uploadsDir, filename));
      removed += 1;
    } catch {
      // already gone — nothing to do
    }
  }
  return removed;
};

// Authorised by a short-lived per-file signature rather than by `protect`.
//
// <img src> cannot carry an Authorization header, and this app authenticates
// with a bearer token rather than a cookie, so requiring `protect` here would
// break every image in every note. Instead the client asks
// POST /api/notes/sign-images for signed URLs (that endpoint IS protected and
// refuses to sign a file the caller does not own), and this route verifies
// the signature.
//
// Net effect: a URL that used to work for anyone, forever, now works for one
// image for one hour. See services/imageSignature.js.
const uploadsRouter = express.Router();

uploadsRouter.get('/:filename', async (req, res) => {
  const { filename } = req.params;
  if (!isSafeFilename(filename)) throw new HttpError(400, 'Invalid file name');

  if (!verifySignature(filename, req.query.exp, req.query.sig)) {
    // One message for "unsigned", "tampered" and "expired" alike — telling
    // them apart would help someone probing for a still-valid signature.
    throw new HttpError(403, 'This image link is invalid or has expired');
  }

  // Private, not public: an intermediary must never hold a copy of one user's
  // image and hand it to the next requester.
  res.set('Cache-Control', 'private, max-age=86400');
  res.set('Content-Type', contentTypeFor(filename));
  // helmet's default CORP is same-origin, which would block the client (a
  // different origin — see client/src/api/axios.js) from rendering these.
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');

  if (s3) {
    let object;
    try {
      object = await s3.send(new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: filename }));
    } catch {
      throw new HttpError(404, 'Image not found');
    }
    return object.Body.pipe(res);
  }

  const filePath = path.join(uploadsDir, filename);
  return res.sendFile(filePath, (err) => {
    if (err && !res.headersSent) res.status(404).json({ message: 'Image not found' });
  });
});

module.exports = { uploadsDir, urlFor, writeFile, deleteFiles, uploadsRouter, isSafeFilename };
