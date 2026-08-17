const request = require('supertest');
const app = require('../app');
const { startDb, stopDb, clearDb, createUser, createNote, auth } = require('./helpers');
const Note = require('../models/Note');
const emailService = require('../services/email');
const aiService = require('../services/aiService');
const { checkDueReminders, sendWeeklyDigests } = require('../services/scheduler');

// Same capture pattern as passwordReset.test.js — sendEmail is spied on
// rather than letting a real provider run, and scheduler.js's namespaced
// require() (see its own file comment) is exactly what makes that spy
// actually take effect instead of silently missing every call. Also stubs
// isEmailConfigured() true — tests/setup.js sets no GMAIL_USER/RESEND_API_KEY
// (no test may talk to a real provider), so the real function would report
// false and scheduler.js's own early-return guard would skip the query
// before sendEmail's spy ever got a chance to run.
let sent;
const captureEmail = () => {
  vi.spyOn(emailService, 'isEmailConfigured').mockReturnValue(true);
  vi.spyOn(emailService, 'sendEmail').mockImplementation(async (message) => {
    sent.push(message);
    return { delivered: true };
  });
};

describe('services/scheduler — reminder emails', () => {
  beforeAll(startDb);
  afterAll(stopDb);
  beforeEach(async () => {
    await clearDb();
    vi.restoreAllMocks();
    sent = [];
    captureEmail();
  });

  it('emails the owner of a due, unnotified reminder and marks it notified', async () => {
    const user = await createUser();
    const note = await createNote(user, {
      title: 'Renew passport',
      reminderAt: new Date(Date.now() - 60_000),
    });

    await checkDueReminders();

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(user.email);
    expect(sent[0].subject).toMatch(/Renew passport/);
    // Deep-links straight to the note (Dashboard.jsx's ?note= handling),
    // not just the bare dashboard.
    expect(sent[0].text).toMatch(new RegExp(`/dashboard\\?note=${note._id}`));

    const updated = await Note.findById(note._id);
    expect(updated.reminderNotifiedAt).toBeInstanceOf(Date);
  });

  it('does not re-email a reminder that was already notified', async () => {
    const user = await createUser();
    await createNote(user, {
      reminderAt: new Date(Date.now() - 60_000),
      reminderNotifiedAt: new Date(Date.now() - 30_000),
    });

    await checkDueReminders();

    expect(sent).toHaveLength(0);
  });

  it('ignores reminders that are not due yet', async () => {
    const user = await createUser();
    await createNote(user, { reminderAt: new Date(Date.now() + 60_000) });

    await checkDueReminders();

    expect(sent).toHaveLength(0);
  });

  it('skips a user who opted out, but still marks the note notified so it is not rechecked forever', async () => {
    const user = await createUser({ emailReminders: false });
    const note = await createNote(user, { reminderAt: new Date(Date.now() - 60_000) });

    await checkDueReminders();

    expect(sent).toHaveLength(0);
    expect((await Note.findById(note._id)).reminderNotifiedAt).toBeInstanceOf(Date);
  });

  it('ignores a trashed note even if its reminder is due', async () => {
    const user = await createUser();
    await createNote(user, { reminderAt: new Date(Date.now() - 60_000), deletedAt: new Date() });

    await checkDueReminders();

    expect(sent).toHaveLength(0);
  });

  it('does nothing when no email provider is configured', async () => {
    vi.spyOn(emailService, 'isEmailConfigured').mockReturnValue(false);
    const user = await createUser();
    await createNote(user, { reminderAt: new Date(Date.now() - 60_000) });

    await checkDueReminders();

    expect(sent).toHaveLength(0);
  });

  // Re-snoozing a reminder must make it eligible for a fresh email — without
  // this reset, a note emailed once would inherit reminderNotifiedAt forever
  // and every future reminderAt on it would be silently skipped.
  it('re-arms a note for a fresh email when its reminderAt is changed via the API', async () => {
    const user = await createUser();
    const note = await createNote(user, {
      reminderAt: new Date(Date.now() - 60_000),
      reminderNotifiedAt: new Date(Date.now() - 30_000),
    });

    await request(app)
      .put(`/api/notes/${note._id}`)
      .set(auth(user))
      .send({ reminderAt: new Date(Date.now() - 5_000).toISOString() })
      .expect(200);

    expect((await Note.findById(note._id)).reminderNotifiedAt).toBeNull();

    await checkDueReminders();
    expect(sent).toHaveLength(1);
  });
});

describe('services/scheduler — weekly digest emails', () => {
  beforeAll(startDb);
  afterAll(stopDb);
  beforeEach(async () => {
    await clearDb();
    vi.restoreAllMocks();
    sent = [];
    captureEmail();
  });

  it('emails a digest to a user with recent notes', async () => {
    vi.spyOn(aiService, 'generateWeeklyDigest').mockResolvedValue('You wrote about passports and travel plans.');
    const user = await createUser();
    await createNote(user, { updatedAt: new Date() });

    await sendWeeklyDigests();

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(user.email);
    expect(sent[0].text).toMatch(/passports and travel plans/);
  });

  it('skips a user with nothing updated in the last 7 days', async () => {
    vi.spyOn(aiService, 'generateWeeklyDigest').mockResolvedValue('irrelevant');
    const user = await createUser();
    const note = await createNote(user);
    // Mongoose's own {timestamps: true} stamps updatedAt with "now" on
    // create() regardless of what's passed in — this backdates it with a
    // direct update (timestamps: false so that update itself doesn't
    // re-stamp it back to "now").
    await Note.updateOne(
      { _id: note._id },
      { $set: { updatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      { timestamps: false }
    );

    await sendWeeklyDigests();

    expect(sent).toHaveLength(0);
  });

  it('skips a user who opted out of the digest', async () => {
    vi.spyOn(aiService, 'generateWeeklyDigest').mockResolvedValue('irrelevant');
    const user = await createUser({ emailWeeklyDigest: false });
    await createNote(user, { updatedAt: new Date() });

    await sendWeeklyDigests();

    expect(sent).toHaveLength(0);
  });

  it('sends nothing (but does not throw) when Gemini returns no digest', async () => {
    vi.spyOn(aiService, 'generateWeeklyDigest').mockResolvedValue('');
    const user = await createUser();
    await createNote(user, { updatedAt: new Date() });

    await expect(sendWeeklyDigests()).resolves.not.toThrow();
    expect(sent).toHaveLength(0);
  });

  it('keeps processing other users after one fails', async () => {
    // Mongo's find() order across two freshly-inserted users isn't something
    // to assert on, so this doesn't assume which of the two hits the
    // rejection first — only that one failure never stops the batch: exactly
    // one of the two still gets emailed.
    vi.spyOn(aiService, 'generateWeeklyDigest')
      .mockRejectedValueOnce(new Error('quota exhausted'))
      .mockResolvedValueOnce('A fine week of notes.');
    const userA = await createUser();
    const userB = await createUser();
    await createNote(userA, { updatedAt: new Date() });
    await createNote(userB, { updatedAt: new Date() });

    await sendWeeklyDigests();

    expect(sent).toHaveLength(1);
    expect([userA.email, userB.email]).toContain(sent[0].to);
  });
});
