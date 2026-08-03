const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const app = require('../app');
const { startDb, stopDb, clearDb, createUser, auth } = require('./helpers');

// `protect` used to verify only the JWT signature, so a deleted or suspended
// account kept working for the full 7-day token lifetime. Suspension in
// particular was a no-op against anyone already signed in — the exact window
// where it needs to work.
describe('session validity', () => {
  beforeAll(startDb);
  afterAll(stopDb);
  beforeEach(clearDb);

  it('accepts a valid session', async () => {
    const user = await createUser();
    expect((await request(app).get('/api/notes').set(auth(user))).status).toBe(200);
  });

  it('rejects a token whose account has been deleted', async () => {
    const user = await createUser();
    const headers = auth(user);
    expect((await request(app).get('/api/notes').set(headers)).status).toBe(200);

    await user.deleteOne();

    const res = await request(app).get('/api/notes').set(headers);
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/no longer exists/i);
  });

  it('rejects an already-issued session once the account is suspended', async () => {
    const user = await createUser();
    const headers = auth(user);
    expect((await request(app).get('/api/notes').set(headers)).status).toBe(200);

    user.suspended = true;
    await user.save();

    const res = await request(app).get('/api/notes').set(headers);
    // 401 not 403 on purpose: the client's axios interceptor treats 401 as
    // "session over" and redirects to /login. A 403 would leave a suspended
    // user stuck in an endlessly erroring UI, still apparently signed in.
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/suspended/i);
  });

  it('rejects a missing, malformed or wrongly-signed token', async () => {
    const user = await createUser();
    const cases = [
      undefined,
      'Bearer not-a-jwt',
      `Bearer ${jwt.sign({ id: user._id.toString() }, 'a-completely-different-secret')}`,
      // Validly signed, but the id isn't an ObjectId — must be a dead session,
      // not a CastError-driven 500.
      `Bearer ${jwt.sign({ id: 'not-an-objectid' }, process.env.JWT_SECRET)}`,
      `Bearer ${jwt.sign({ id: new mongoose.Types.ObjectId().toString() }, process.env.JWT_SECRET, { expiresIn: '-1s' })}`,
    ];

    for (const header of cases) {
      const req = request(app).get('/api/notes');
      if (header) req.set('Authorization', header);
      expect((await req).status).toBe(401);
    }
  });
});

// Malformed input must produce a 4xx, not a 500. Every one of these used to
// fall through to the generic "Server error" handler, which made real client
// mistakes indistinguishable from genuine server faults in the logs.
describe('input handling', () => {
  beforeAll(startDb);
  afterAll(stopDb);
  beforeEach(clearDb);

  it('returns 400, not 500, for a malformed ObjectId', async () => {
    const user = await createUser();
    const res = await request(app).get('/api/notes/not-an-id').set(auth(user));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid id/i);
  });

  it('returns 404 for a well-formed id that does not exist', async () => {
    const user = await createUser();
    const id = new mongoose.Types.ObjectId();
    expect((await request(app).get(`/api/notes/${id}`).set(auth(user))).status).toBe(404);
  });

  it('returns 400, not 500, for malformed JSON', async () => {
    const user = await createUser();
    const res = await request(app)
      .post('/api/notes')
      .set(auth(user))
      .set('Content-Type', 'application/json')
      .send('{"title":');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/malformed json/i);
  });

  it('never leaks an internal error message to the client', async () => {
    const res = await request(app).get('/api/notes/not-an-id');
    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).not.toMatch(/stack|mongo|cast/i);
  });
});
