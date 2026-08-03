// `vi` and the test globals come from vitest's `globals: true` — vitest's own
// module is ESM-only and can't be require()'d from these CommonJS tests.
const request = require('supertest');

const app = require('../app');
const { startDb, stopDb, clearDb, createUser, auth } = require('./helpers');
const User = require('../models/User');

// Google's own verification is stubbed — these tests are about what this app
// does with a *verified* identity, not about re-testing google-auth-library.
const { OAuth2Client } = require('google-auth-library');

const stubGoogle = (payload) =>
  vi.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({ getPayload: () => payload });

const GOOGLE_SUB = 'google-subject-1234';
const verified = (overrides = {}) => ({
  sub: GOOGLE_SUB,
  email: 'person@gmail.test',
  email_verified: true,
  name: 'Person',
  ...overrides,
});

describe('Google identity linking', () => {
  beforeAll(async () => {
    await startDb();
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  });
  afterAll(async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    await stopDb();
  });
  beforeEach(async () => {
    await clearDb();
    vi.restoreAllMocks();
  });

  // The hole this closes: updateProfile lets any user set their email to any
  // address not currently in use, and nothing verifies ownership. Matching an
  // incoming Google identity to an existing account BY EMAIL therefore let an
  // attacker register, change their address to victim@gmail.test before the
  // victim signed up, and capture the victim's first Google sign-in — landing
  // them inside the attacker's account, which the attacker still has the
  // password to.
  it('refuses to adopt an existing account that merely shares the email', async () => {
    await createUser({ email: 'person@gmail.test' });
    stubGoogle(verified());

    const res = await request(app).post('/api/auth/google').send({ credential: 'x' });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already exists/i);
    // Critically: the pre-existing account must NOT have been linked.
    const untouched = await User.findOne({ email: 'person@gmail.test' });
    expect(untouched.googleId).toBeUndefined();
  });

  it('still auto-provisions a brand-new email (nobody can pre-claim a nonexistent account)', async () => {
    stubGoogle(verified({ email: 'brand-new@gmail.test' }));

    const res = await request(app).post('/api/auth/google').send({ credential: 'x' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    const created = await User.findOne({ email: 'brand-new@gmail.test' });
    expect(created.googleId).toBe(GOOGLE_SUB);
    expect(created.password).toBeUndefined();
  });

  it('signs in a already-linked account by googleId', async () => {
    await createUser({ email: 'linked@gmail.test', googleId: GOOGLE_SUB });
    stubGoogle(verified({ email: 'linked@gmail.test' }));

    const res = await request(app).post('/api/auth/google').send({ credential: 'x' });
    expect(res.status).toBe(200);
  });

  it('rejects an unverified Google email', async () => {
    stubGoogle(verified({ email_verified: false }));
    const res = await request(app).post('/api/auth/google').send({ credential: 'x' });
    expect(res.status).toBe(401);
  });

  it('links from an authenticated session — the supported path', async () => {
    const user = await createUser();
    stubGoogle(verified());

    const res = await request(app).post('/api/auth/google/link').set(auth(user)).send({ credential: 'x' });

    expect(res.status).toBe(200);
    expect(res.body.hasGoogle).toBe(true);
    expect((await User.findById(user._id)).googleId).toBe(GOOGLE_SUB);
  });

  it('refuses to link a Google account already used by someone else', async () => {
    await createUser({ googleId: GOOGLE_SUB });
    const other = await createUser();
    stubGoogle(verified());

    const res = await request(app).post('/api/auth/google/link').set(auth(other)).send({ credential: 'x' });

    expect(res.status).toBe(409);
    expect((await User.findById(other._id)).googleId).toBeUndefined();
  });

  it('requires a session to link', async () => {
    stubGoogle(verified());
    expect((await request(app).post('/api/auth/google/link').send({ credential: 'x' })).status).toBe(401);
  });

  it('refuses to unlink when that would leave no way to sign in', async () => {
    // A Google-only account has no password; unlinking would make it
    // permanently unreachable, and this app has no email-based recovery.
    const user = await createUser({ googleId: GOOGLE_SUB, password: undefined });

    const res = await request(app).delete('/api/auth/google/link').set(auth(user));

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/locked out/i);
    expect((await User.findById(user._id)).googleId).toBe(GOOGLE_SUB);
  });

  it('allows unlinking when a password remains', async () => {
    const user = await createUser({ googleId: GOOGLE_SUB });

    const res = await request(app).delete('/api/auth/google/link').set(auth(user));

    expect(res.status).toBe(200);
    expect((await User.findById(user._id)).googleId).toBeUndefined();
  });

  it('reports linkage state via /auth/me', async () => {
    const user = await createUser({ googleId: GOOGLE_SUB });
    const res = await request(app).get('/api/auth/me').set(auth(user));
    expect(res.body.hasGoogle).toBe(true);
    expect(res.body.hasPassword).toBe(true);
  });
});
