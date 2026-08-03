const request = require('supertest');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const app = require('../app');
const { startDb, stopDb, clearDb, createUser, auth } = require('./helpers');
const User = require('../models/User');
const PasswordResetToken = require('../models/PasswordResetToken');
const emailService = require('../services/email');

// The raw token only ever exists in the email body, so tests capture it the
// same way a user would — from the message that was "sent".
let sent;
const captureEmail = () =>
  vi.spyOn(emailService, 'sendEmail').mockImplementation(async (message) => {
    sent = message;
    return { delivered: true };
  });

const tokenFromEmail = () => {
  const match = sent?.text?.match(/reset-password\?token=([\w-]+)/);
  return match?.[1];
};

const withPassword = async (plain, overrides = {}) =>
  createUser({ password: await bcrypt.hash(plain, 10), ...overrides });

const requestReset = (email) => request(app).post('/api/auth/forgot-password').send({ email });
const doReset = (token, newPassword) => request(app).post('/api/auth/reset-password').send({ token, newPassword });

describe('forgot password', () => {
  beforeAll(startDb);
  afterAll(stopDb);
  beforeEach(async () => {
    await clearDb();
    vi.restoreAllMocks();
    sent = undefined;
    captureEmail();
  });

  it('emails a reset link to a real account', async () => {
    const user = await withPassword('old-password');

    const res = await requestReset(user.email);

    expect(res.status).toBe(200);
    expect(sent.to).toBe(user.email);
    expect(tokenFromEmail()).toBeTruthy();
    expect(await PasswordResetToken.countDocuments({ user: user._id })).toBe(1);
  });

  // The response must not reveal whether an account exists, or this endpoint
  // becomes an account-enumeration oracle anyone can query.
  it('gives an identical response for an unknown address', async () => {
    const user = await withPassword('old-password');

    const known = await requestReset(user.email);
    sent = undefined;
    const unknown = await requestReset('nobody-here@test.invalid');

    expect(unknown.status).toBe(known.status);
    expect(unknown.body).toEqual(known.body);
    // ...but no email is actually sent, and no token is minted.
    expect(sent).toBeUndefined();
    expect(await PasswordResetToken.countDocuments({})).toBe(1);
  });

  it('does not issue a reset for a Google-only account', async () => {
    // It has no password to reset, and sending a link would let anyone who
    // merely knows the address attach a password to it.
    const user = await createUser({ password: undefined, googleId: 'g-1' });

    const res = await requestReset(user.email);

    expect(res.status).toBe(200);
    expect(sent).toBeUndefined();
    expect(await PasswordResetToken.countDocuments({})).toBe(0);
  });

  it('stores the token hashed, never in plaintext', async () => {
    const user = await withPassword('old-password');
    await requestReset(user.email);

    const raw = tokenFromEmail();
    const record = await PasswordResetToken.findOne({ user: user._id });

    expect(record.tokenHash).not.toBe(raw);
    expect(record.tokenHash).toBe(crypto.createHash('sha256').update(raw).digest('hex'));
  });

  it('invalidates the previous link when a new one is requested', async () => {
    const user = await withPassword('old-password');

    await requestReset(user.email);
    const firstToken = tokenFromEmail();

    await requestReset(user.email);
    const secondToken = tokenFromEmail();

    expect(secondToken).not.toBe(firstToken);
    expect(await PasswordResetToken.countDocuments({ user: user._id })).toBe(1);
    expect((await doReset(firstToken, 'brand-new-password')).status).toBe(400);
    expect((await doReset(secondToken, 'brand-new-password')).status).toBe(200);
  });

  it('still responds 200 when the email provider fails', async () => {
    // A provider outage must not change the response shape — the difference
    // between success and failure would itself leak account existence.
    vi.spyOn(emailService, 'sendEmail').mockRejectedValue(new Error('provider down'));
    const user = await withPassword('old-password');

    expect((await requestReset(user.email)).status).toBe(200);
  });
});

describe('reset password', () => {
  beforeAll(startDb);
  afterAll(stopDb);
  beforeEach(async () => {
    await clearDb();
    vi.restoreAllMocks();
    sent = undefined;
    captureEmail();
  });

  it('sets the new password and lets the user sign in with it', async () => {
    const user = await withPassword('old-password');
    await requestReset(user.email);

    const res = await doReset(tokenFromEmail(), 'a-brand-new-password');
    expect(res.status).toBe(200);

    const login = await request(app).post('/api/auth/login')
      .send({ email: user.email, password: 'a-brand-new-password' });
    expect(login.status).toBe(200);

    const oldLogin = await request(app).post('/api/auth/login')
      .send({ email: user.email, password: 'old-password' });
    expect(oldLogin.status).toBe(400);
  });

  it('consumes the token — it cannot be replayed', async () => {
    const user = await withPassword('old-password');
    await requestReset(user.email);
    const token = tokenFromEmail();

    expect((await doReset(token, 'first-new-password')).status).toBe(200);
    expect((await doReset(token, 'second-new-password')).status).toBe(400);
    expect(await PasswordResetToken.countDocuments({ user: user._id })).toBe(0);
  });

  it('rejects an expired token', async () => {
    const user = await withPassword('old-password');
    await requestReset(user.email);
    const token = tokenFromEmail();

    await PasswordResetToken.updateOne(
      { user: user._id },
      { $set: { expiresAt: new Date(Date.now() - 1000) } }
    );

    const res = await doReset(token, 'a-brand-new-password');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid or has expired/i);
  });

  it('rejects a forged token and says nothing useful about why', async () => {
    const res = await doReset('completely-made-up-token', 'a-brand-new-password');
    expect(res.status).toBe(400);
    // Same wording as the expired case — a distinct message would confirm a
    // guessed token was genuine.
    expect(res.body.message).toMatch(/invalid or has expired/i);
  });

  it('enforces the minimum password length', async () => {
    const user = await withPassword('old-password');
    await requestReset(user.email);

    const res = await doReset(tokenFromEmail(), 'short');
    expect(res.status).toBe(400);
    expect(res.body.errors?.newPassword).toMatch(/8 characters/i);
  });

  // A reset is normally performed because the account is believed
  // compromised, so leaving already-issued tokens valid for the rest of their
  // 7-day life would defeat the point.
  it('signs out sessions issued before the reset', async () => {
    const user = await withPassword('old-password');
    // Backdated deliberately. JWT `iat` has one-second resolution, so a token
    // minted in the same second as the reset is indistinguishable from the
    // fresh one the user gets by signing in immediately afterwards — and the
    // comparison is intentionally lenient in that tie (see the same-second
    // test below). A genuinely pre-existing session is minutes or days old,
    // which is what this asserts against.
    const oldSession = {
      Authorization: `Bearer ${jwt.sign(
        { id: user._id.toString(), iat: Math.floor(Date.now() / 1000) - 3600 },
        process.env.JWT_SECRET
      )}`,
    };

    expect((await request(app).get('/api/notes').set(oldSession)).status).toBe(200);

    await requestReset(user.email);
    await doReset(tokenFromEmail(), 'a-brand-new-password');

    const res = await request(app).get('/api/notes').set(oldSession);
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/password was changed/i);
  });

  it('accepts a session issued after the reset', async () => {
    const user = await withPassword('old-password');
    await requestReset(user.email);
    await doReset(tokenFromEmail(), 'a-brand-new-password');

    const login = await request(app).post('/api/auth/login')
      .send({ email: user.email, password: 'a-brand-new-password' });

    const res = await request(app).get('/api/notes').set('Authorization', `Bearer ${login.body.token}`);
    expect(res.status).toBe(200);
  });

  it('does not reject a token minted in the same second as the reset', async () => {
    // iat has one-second resolution, so a strict comparison against a
    // sub-second passwordChangedAt would log the user out of the very session
    // they just created.
    const user = await withPassword('old-password');
    user.passwordChangedAt = new Date();
    await user.save();

    const sameSecondToken = jwt.sign(
      { id: user._id.toString(), iat: Math.floor(user.passwordChangedAt.getTime() / 1000) },
      process.env.JWT_SECRET
    );

    const res = await request(app).get('/api/notes').set('Authorization', `Bearer ${sameSecondToken}`);
    expect(res.status).toBe(200);
  });

  it('deletes outstanding reset tokens when the account is deleted', async () => {
    const user = await withPassword('old-password');
    await requestReset(user.email);
    expect(await PasswordResetToken.countDocuments({ user: user._id })).toBe(1);

    await request(app).delete('/api/auth/account').set(auth(user)).send({ password: 'old-password' }).expect(200);

    expect(await PasswordResetToken.countDocuments({ user: user._id })).toBe(0);
    expect(await User.findById(user._id)).toBeNull();
  });
});
