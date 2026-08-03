const request = require('supertest');
const bcrypt = require('bcryptjs');

const app = require('../app');
const { startDb, stopDb, clearDb, createUser, createNote, auth } = require('./helpers');
const User = require('../models/User');
const Note = require('../models/Note');

const withRealPassword = async (plain) =>
  createUser({ password: await bcrypt.hash(plain, 10) });

// GET /auth/me used to project the password field away and then derive
// hasPassword from it, so it reported false for every account. The client
// gates the account-deletion password prompt on that flag, so the prompt
// never rendered, an empty password was posted, and deletion failed for
// everyone with "Password is incorrect".
describe('GET /auth/me', () => {
  beforeAll(startDb);
  afterAll(stopDb);
  beforeEach(clearDb);

  it('reports hasPassword true for a password account', async () => {
    const user = await withRealPassword('correct-horse');
    const res = await request(app).get('/api/auth/me').set(auth(user));

    expect(res.status).toBe(200);
    expect(res.body.hasPassword).toBe(true);
  });

  it('reports hasPassword false for a Google-only account', async () => {
    const user = await createUser({ password: undefined, googleId: 'g-1' });
    const res = await request(app).get('/api/auth/me').set(auth(user));

    expect(res.body.hasPassword).toBe(false);
    expect(res.body.hasGoogle).toBe(true);
  });

  it('never returns the password hash', async () => {
    const user = await withRealPassword('correct-horse');
    const res = await request(app).get('/api/auth/me').set(auth(user));

    expect(res.body.password).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/\$2[aby]\$/);
  });
});

describe('self-service account deletion', () => {
  beforeAll(startDb);
  afterAll(stopDb);
  beforeEach(clearDb);

  it('deletes the account and its notes when the password is correct', async () => {
    const user = await withRealPassword('correct-horse');
    await createNote(user);

    const res = await request(app)
      .delete('/api/auth/account')
      .set(auth(user))
      .send({ password: 'correct-horse' });

    expect(res.status).toBe(200);
    expect(await User.findById(user._id)).toBeNull();
    expect(await Note.countDocuments({ user: user._id })).toBe(0);
  });

  it('refuses a wrong or empty password', async () => {
    const user = await withRealPassword('correct-horse');

    for (const password of ['wrong-password', '']) {
      const res = await request(app).delete('/api/auth/account').set(auth(user)).send({ password });
      expect(res.status).toBe(400);
    }

    expect(await User.findById(user._id)).not.toBeNull();
  });

  it('lets a Google-only account delete without a password (it has none to check)', async () => {
    const user = await createUser({ password: undefined, googleId: 'g-2' });

    const res = await request(app).delete('/api/auth/account').set(auth(user)).send({ password: '' });

    expect(res.status).toBe(200);
    expect(await User.findById(user._id)).toBeNull();
  });
});
