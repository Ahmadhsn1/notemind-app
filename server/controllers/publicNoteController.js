const Note = require('../models/Note');
const HttpError = require('../utils/HttpError');
const { imageFilenamesIn } = require('../services/dataCleanup');
const { signFilename } = require('../services/imageSignature');

// This file exists separately from noteController.js on purpose — it is the
// app's only unauthenticated data route, and keeping it apart (own file, own
// router, own mount in app.js) means it can never accidentally start reusing
// an authenticated helper like loadOwnedNote, or end up behind a `protect`
// someone adds to noteRoutes.js later without noticing this route came along
// for the ride.
//
// Hand-built response shape, never a raw Mongoose document: `user`,
// `embedding`, `links`, `reminderAt`, `folder` and — obviously —
// `shareToken` itself must never reach an anonymous caller.
const PUBLIC_PROJECTION = 'title contentHtml body tags createdAt updatedAt';

// A shared note's contentHtml still stores plain relative /uploads/...
// paths (same as every note) — signs each one server-side, the same
// signFilename() the authenticated /notes/sign-images endpoint uses, so the
// client gets back HTML it can render immediately with no second round
// trip. Ownership isn't re-checked here the way signImageUrls checks it for
// an authenticated caller — reaching this point already proves the caller
// holds a valid share token for the note these images belong to, which is
// the authorization.
const signImagesInHtml = (html) => {
  if (!html) return html;
  let result = html;
  for (const filename of imageFilenamesIn(html)) {
    const { exp, sig } = signFilename(filename);
    result = result.split(`/uploads/${filename}`).join(`/uploads/${filename}?exp=${exp}&sig=${sig}`);
  }
  return result;
};

const NOT_SHARED_MESSAGE = 'This link is invalid or the note is no longer shared';

const getSharedNote = async (req, res) => {
  const { token } = req.params;
  // Real tokens are base64url from 20 bytes (~27 chars); this is just a
  // cheap early reject for obviously-wrong input, not the actual security
  // boundary — that's the token's entropy plus the query below.
  if (typeof token !== 'string' || token.length === 0 || token.length > 64) {
    throw new HttpError(404, NOT_SHARED_MESSAGE);
  }

  // archivedAt/deletedAt: null — a note the owner archived or trashed after
  // sharing it must stop being publicly visible immediately, without the
  // owner having to remember to separately revoke the link too.
  const note = await Note.findOne({ shareToken: token, archivedAt: null, deletedAt: null })
    .select(PUBLIC_PROJECTION);
  if (!note) throw new HttpError(404, NOT_SHARED_MESSAGE);

  // Never indexed — a shared link is for whoever holds it, not for search
  // engines to crawl and surface to strangers. This covers the API response
  // itself; the client route also sets a <meta name="robots"> tag, since
  // this header alone doesn't govern how crawlers treat the SPA page that
  // fetches it.
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.status(200).json({
    title: note.title,
    contentHtml: signImagesInHtml(note.contentHtml),
    body: note.body,
    tags: note.tags,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  });
};

module.exports = { getSharedNote };
