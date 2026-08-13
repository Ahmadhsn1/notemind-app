const request = require('supertest');

const app = require('../app');
const { startDb, stopDb, clearDb, createUser, createNote, auth } = require('./helpers');
const Note = require('../models/Note');
const Resurface = require('../models/Resurface');

// Every assertion in this file cares about *local* calendar days, so it pins
// the process to a real DST-observing zone rather than trusting whatever the
// machine/CI runner happens to be set to (often UTC, which has no DST and
// would silently make every one of these tests pass regardless of the bug).
// 2026's US spring-forward is Sunday 2026-03-08 — clocks jump 2:00am to
// 3:00am, so that local calendar day is only 23 hours of real time.
const ORIGINAL_TZ = process.env.TZ;

describe('streak endpoints across a DST boundary', () => {
  beforeAll(() => {
    process.env.TZ = 'America/New_York';
  });
  afterAll(() => {
    process.env.TZ = ORIGINAL_TZ;
  });

  beforeAll(startDb);
  afterAll(stopDb);
  beforeEach(clearDb);

  afterEach(() => {
    vi.useRealTimers();
  });

  // "Now" is pinned to noon UTC (mid-morning Eastern) on the day after the
  // transition, well clear of the 2am jump itself, so the only thing under
  // test is whether the day-by-day walk-back correctly counts through it.
  const NOW = new Date('2026-03-10T15:00:00Z'); // 11:00 EDT, March 10

  it('GET /api/resurface/streak counts every day straight through the transition', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    const user = await createUser();
    // 2026-03-06 (Fri) through 2026-03-10 (Tue), spanning the 03-08 jump.
    for (const date of ['2026-03-06', '2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10']) {
      await Resurface.create({ user: user._id, date, method: 'semantic', engagedAt: new Date(NOW) });
    }

    const res = await request(app).get('/api/resurface/streak').set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body.streak).toBe(5);
    expect(res.body.longestStreak).toBe(5);
    // Every day in the trailing window that falls in the seeded range should
    // show active — a skipped/duplicated day here is exactly how the bug
    // used to surface visually on the dashboard.
    const activeDates = res.body.days.filter((d) => d.active).map((d) => d.date);
    expect(activeDates).toEqual(['2026-03-06', '2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10']);
  });

  it('GET /api/notes/streak counts every day straight through the transition', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    const user = await createUser();
    // Mongoose's timestamps option overwrites createdAt/updatedAt on every
    // save, so backdating them means going around it via the raw driver —
    // noon UTC each day, safely clear of local midnight in either EST/EDT
    // offset so it can't land on the wrong calendar day by construction.
    for (const day of [6, 7, 8, 9, 10]) {
      const note = await createNote(user, { title: `Note ${day}` });
      await Note.collection.updateOne(
        { _id: note._id },
        { $set: { updatedAt: new Date(`2026-03-${String(day).padStart(2, '0')}T12:00:00Z`) } },
      );
    }

    const res = await request(app).get('/api/notes/streak').set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body.streak).toBe(5);
    expect(res.body.longestStreak).toBe(5);
  });

  it('GET /api/notes/activity enumerates exactly one entry per calendar day across the transition', async () => {
    const user = await createUser();

    const res = await request(app)
      .get('/api/notes/activity')
      .query({ from: '2026-03-05', to: '2026-03-12' })
      .set(auth(user));

    expect(res.status).toBe(200);
    expect(res.body.days.map((d) => d.date)).toEqual([
      '2026-03-05', '2026-03-06', '2026-03-07', '2026-03-08',
      '2026-03-09', '2026-03-10', '2026-03-11', '2026-03-12',
    ]);
  });
});
