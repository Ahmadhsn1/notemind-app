// describe/it/expect/hooks come from vitest's `globals: true` (vitest.config.js).
// They are deliberately NOT required here: vitest's own module is ESM-only and
// cannot be pulled in via require() from these CommonJS test files, which match
// the CommonJS server code they exercise.
const request = require('supertest');

const app = require('../app');
const { startDb, stopDb, clearDb, createUser, createNote, auth } = require('./helpers');
const Flashcard = require('../models/Flashcard');

// The single most important property in the app: one user must never be able
// to reach another user's data. Every note-scoped endpoint enforces this via
// loadOwnedNote, and flashcards via an equivalent inline check — but nothing
// verified it, so a refactor could silently drop a check on one route and
// nobody would notice. Each route is asserted individually rather than
// spot-checked, because that is exactly the failure mode.
describe('note ownership', () => {
  let owner;
  let attacker;
  let note;

  beforeAll(startDb);
  afterAll(stopDb);

  beforeEach(async () => {
    await clearDb();
    owner = await createUser();
    attacker = await createUser();
    note = await createNote(owner);
  });

  const routes = [
    ['get', (id) => `/api/notes/${id}`],
    ['put', (id) => `/api/notes/${id}`],
    ['delete', (id) => `/api/notes/${id}`],
    ['post', (id) => `/api/notes/${id}/restore`],
    ['delete', (id) => `/api/notes/${id}/permanent`],
    ['patch', (id) => `/api/notes/${id}/pin`],
    ['patch', (id) => `/api/notes/${id}/archive`],
    ['patch', (id) => `/api/notes/${id}/unarchive`],
    ['get', (id) => `/api/notes/${id}/versions`],
    ['get', (id) => `/api/notes/${id}/flashcards`],
  ];

  for (const [method, path] of routes) {
    it(`${method.toUpperCase()} ${path(':id')} refuses a note owned by someone else`, async () => {
      const res = await request(app)[method](path(note._id)).set(auth(attacker)).send({ title: 'hijacked' });
      expect(res.status).toBe(403);
    });
  }

  it('allows the owner through the same route', async () => {
    const res = await request(app).get(`/api/notes/${note._id}`).set(auth(owner));
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('A note');
  });

  it('does not leak another user notes via the list endpoint', async () => {
    const res = await request(app).get('/api/notes').set(auth(attacker));
    expect(res.status).toBe(200);
    expect(res.body.notes).toHaveLength(0);
  });

  it('refuses to review or delete a flashcard owned by someone else', async () => {
    const card = await Flashcard.create({ user: owner._id, note: note._id, question: 'q', answer: 'a' });

    const review = await request(app).post(`/api/flashcards/${card._id}/review`).set(auth(attacker)).send({ quality: 5 });
    expect(review.status).toBe(403);

    const del = await request(app).delete(`/api/flashcards/${card._id}`).set(auth(attacker));
    expect(del.status).toBe(403);
  });
});

// Admin authority is re-read from the database on every request rather than
// trusted from the JWT, so a demotion takes effect immediately.
describe('admin authorization', () => {
  beforeAll(startDb);
  afterAll(stopDb);
  beforeEach(clearDb);

  it('refuses a normal user', async () => {
    const user = await createUser();
    const res = await request(app).get('/api/admin/stats').set(auth(user));
    expect(res.status).toBe(403);
  });

  it('allows an admin', async () => {
    const admin = await createUser({ role: 'admin' });
    const res = await request(app).get('/api/admin/stats').set(auth(admin));
    expect(res.status).toBe(200);
  });

  it('applies a role change to an already-issued token', async () => {
    const user = await createUser({ role: 'admin' });
    const headers = auth(user);

    expect((await request(app).get('/api/admin/stats').set(headers)).status).toBe(200);

    user.role = 'user';
    await user.save();

    // Same token, no re-login.
    expect((await request(app).get('/api/admin/stats').set(headers)).status).toBe(403);
  });
});
