const request = require('supertest');

const app = require('../app');
const { startDb, stopDb, clearDb, createUser, createNote, auth } = require('./helpers');
const Note = require('../models/Note');

describe('note sharing', () => {
  beforeAll(startDb);
  afterAll(stopDb);
  beforeEach(clearDb);

  describe('GET /notes/:id/share (status check)', () => {
    it('reports not shared for a fresh note', async () => {
      const user = await createUser();
      const note = await createNote(user);

      const res = await request(app).get(`/api/notes/${note._id}/share`).set(auth(user));

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ shared: false });
    });

    it('never creates a share just by checking status', async () => {
      const user = await createUser();
      const note = await createNote(user);

      await request(app).get(`/api/notes/${note._id}/share`).set(auth(user));

      const stored = await Note.findById(note._id).select('+shareToken');
      expect(stored.shareToken).toBeUndefined();
    });

    it('refuses another user\'s note', async () => {
      const owner = await createUser();
      const stranger = await createUser();
      const note = await createNote(owner);

      const res = await request(app).get(`/api/notes/${note._id}/share`).set(auth(stranger));
      expect(res.status).toBe(403);
    });
  });

  describe('POST /notes/:id/share (create)', () => {
    it('creates a share link and returns it', async () => {
      const user = await createUser();
      const note = await createNote(user);

      const res = await request(app).post(`/api/notes/${note._id}/share`).set(auth(user));

      expect(res.status).toBe(200);
      expect(res.body.shared).toBe(true);
      expect(res.body.shareUrl).toMatch(/\/share\/.+/);
      expect(res.body.sharedAt).toBeTruthy();
    });

    it('is idempotent — calling it again returns the same link, not a new one', async () => {
      const user = await createUser();
      const note = await createNote(user);

      const first = await request(app).post(`/api/notes/${note._id}/share`).set(auth(user));
      const second = await request(app).post(`/api/notes/${note._id}/share`).set(auth(user));

      expect(second.body.shareUrl).toBe(first.body.shareUrl);
    });

    it('refuses to share an archived note', async () => {
      const user = await createUser();
      const note = await createNote(user, { archivedAt: new Date() });

      const res = await request(app).post(`/api/notes/${note._id}/share`).set(auth(user));
      expect(res.status).toBe(400);
    });

    it('refuses to share a trashed note', async () => {
      const user = await createUser();
      const note = await createNote(user, { deletedAt: new Date() });

      const res = await request(app).post(`/api/notes/${note._id}/share`).set(auth(user));
      expect(res.status).toBe(400);
    });

    it('refuses to share another user\'s note', async () => {
      const owner = await createUser();
      const stranger = await createUser();
      const note = await createNote(owner);

      const res = await request(app).post(`/api/notes/${note._id}/share`).set(auth(stranger));
      expect(res.status).toBe(403);

      const stored = await Note.findById(note._id).select('+shareToken');
      expect(stored.shareToken).toBeUndefined();
    });
  });

  describe('DELETE /notes/:id/share (revoke)', () => {
    it('revokes an active share', async () => {
      const user = await createUser();
      const note = await createNote(user);
      await request(app).post(`/api/notes/${note._id}/share`).set(auth(user));

      const res = await request(app).delete(`/api/notes/${note._id}/share`).set(auth(user));
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ shared: false });

      const stored = await Note.findById(note._id).select('+shareToken');
      expect(stored.shareToken).toBeUndefined();
    });

    it('lets the owner revoke sharing on an archived note too', async () => {
      const user = await createUser();
      const note = await createNote(user);
      await request(app).post(`/api/notes/${note._id}/share`).set(auth(user));
      await Note.findByIdAndUpdate(note._id, { archivedAt: new Date() });

      const res = await request(app).delete(`/api/notes/${note._id}/share`).set(auth(user));
      expect(res.status).toBe(200);
    });

    it('a second revoke of an already-unshared note is a harmless no-op', async () => {
      const user = await createUser();
      const note = await createNote(user);

      const res = await request(app).delete(`/api/notes/${note._id}/share`).set(auth(user));
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ shared: false });
    });
  });

  describe('GET /api/public/notes/:token (the public route)', () => {
    it('serves a shared note with no auth at all', async () => {
      const user = await createUser();
      const note = await createNote(user, { title: 'Public title', body: 'public body', contentHtml: '<p>public body</p>' });
      const shareRes = await request(app).post(`/api/notes/${note._id}/share`).set(auth(user));
      const token = shareRes.body.shareUrl.split('/share/')[1];

      const res = await request(app).get(`/api/public/notes/${token}`);

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Public title');
      expect(res.body.contentHtml).toContain('public body');
      expect(res.headers['x-robots-tag']).toMatch(/noindex/);
    });

    // The whole point of a hand-built response — proven directly on the
    // wire format, not just "the controller doesn't select these fields",
    // since a future refactor could easily reintroduce a leak the unit-level
    // reasoning wouldn't catch.
    it('never exposes owner identity, embedding, or the share token itself', async () => {
      const user = await createUser();
      const note = await createNote(user);
      const shareRes = await request(app).post(`/api/notes/${note._id}/share`).set(auth(user));
      const token = shareRes.body.shareUrl.split('/share/')[1];

      const res = await request(app).get(`/api/public/notes/${token}`);
      const raw = JSON.stringify(res.body);

      expect(res.body.user).toBeUndefined();
      expect(res.body.embedding).toBeUndefined();
      expect(res.body.shareToken).toBeUndefined();
      expect(res.body.reminderAt).toBeUndefined();
      expect(raw).not.toContain(user._id.toString());
      expect(raw).not.toContain(token);
    });

    it('404s for a token that was never shared', async () => {
      const res = await request(app).get('/api/public/notes/not-a-real-token-at-all');
      expect(res.status).toBe(404);
    });

    it('404s after the owner revokes the link — the old URL stops working', async () => {
      const user = await createUser();
      const note = await createNote(user);
      const shareRes = await request(app).post(`/api/notes/${note._id}/share`).set(auth(user));
      const token = shareRes.body.shareUrl.split('/share/')[1];

      await request(app).delete(`/api/notes/${note._id}/share`).set(auth(user));

      const res = await request(app).get(`/api/public/notes/${token}`);
      expect(res.status).toBe(404);
    });

    it('404s for a shared note the owner later archives', async () => {
      const user = await createUser();
      const note = await createNote(user);
      const shareRes = await request(app).post(`/api/notes/${note._id}/share`).set(auth(user));
      const token = shareRes.body.shareUrl.split('/share/')[1];

      await Note.findByIdAndUpdate(note._id, { archivedAt: new Date() });

      const res = await request(app).get(`/api/public/notes/${token}`);
      expect(res.status).toBe(404);
    });

    it('404s for a shared note the owner later trashes', async () => {
      const user = await createUser();
      const note = await createNote(user);
      const shareRes = await request(app).post(`/api/notes/${note._id}/share`).set(auth(user));
      const token = shareRes.body.shareUrl.split('/share/')[1];

      await Note.findByIdAndUpdate(note._id, { deletedAt: new Date() });

      const res = await request(app).get(`/api/public/notes/${token}`);
      expect(res.status).toBe(404);
    });

    it('signs image references in the shared HTML', async () => {
      const user = await createUser();
      const note = await createNote(user, {
        contentHtml: '<p>see <img src="/uploads/abc123.png" alt=""></p>',
      });
      const shareRes = await request(app).post(`/api/notes/${note._id}/share`).set(auth(user));
      const token = shareRes.body.shareUrl.split('/share/')[1];

      const res = await request(app).get(`/api/public/notes/${token}`);
      expect(res.body.contentHtml).toMatch(/\/uploads\/abc123\.png\?exp=\d+&sig=/);
    });
  });
});
