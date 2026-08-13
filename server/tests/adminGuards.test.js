const request = require('supertest');

const app = require('../app');
const { startDb, stopDb, clearDb, createUser, auth } = require('./helpers');
const { guardNotLastAdmin } = require('../controllers/adminController');

// guardNotSelf (already in place) means no single valid request can ever
// route the acting admin's own account into guardNotLastAdmin — an admin
// can't target themselves, and requireAdmin re-checks role fresh from the DB
// every request, so the requester is always still an admin by the time any
// of these mutations run. That leaves exactly one way to actually reach
// zero admins: two admins' requests racing each other (A demotes B while B
// concurrently demotes A, each authorized before the other's write lands).
// The unit tests below exercise guardNotLastAdmin's own contract directly,
// which is what actually protects against that race; the HTTP-level tests
// confirm the guard doesn't over-block ordinary multi-admin management.
describe('guardNotLastAdmin', () => {
  beforeAll(startDb);
  afterAll(stopDb);
  beforeEach(clearDb);

  it('refuses an action that would leave zero admins', async () => {
    const soleAdmin = await createUser({ role: 'admin' });
    await expect(guardNotLastAdmin([soleAdmin._id])).rejects.toMatchObject({ status: 400 });
  });

  it('allows it when another admin remains', async () => {
    const admin1 = await createUser({ role: 'admin' });
    await createUser({ role: 'admin' });
    await expect(guardNotLastAdmin([admin1._id])).resolves.toBeUndefined();
  });

  it('is a no-op for ids that are not admins', async () => {
    await createUser({ role: 'admin' });
    const regular = await createUser();
    await expect(guardNotLastAdmin([regular._id])).resolves.toBeUndefined();
  });

  it('sums correctly across a batch of ids', async () => {
    const admin1 = await createUser({ role: 'admin' });
    const admin2 = await createUser({ role: 'admin' });
    // Both admins in one batch, no third admin left standing.
    await expect(guardNotLastAdmin([admin1._id, admin2._id])).rejects.toMatchObject({ status: 400 });
  });
});

describe('admin role/delete mutations stay usable with multiple admins', () => {
  beforeAll(startDb);
  afterAll(stopDb);
  beforeEach(clearDb);

  it('PATCH role still succeeds when another admin remains', async () => {
    const actingAdmin = await createUser({ role: 'admin' });
    const otherAdmin = await createUser({ role: 'admin' });

    const res = await request(app)
      .patch(`/api/admin/users/${otherAdmin._id}/role`)
      .set(auth(actingAdmin))
      .send({ role: 'user' });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('user');
  });

  it('bulk delete still succeeds when the acting admin is excluded and another remains', async () => {
    const actingAdmin = await createUser({ role: 'admin' });
    const otherAdmin = await createUser({ role: 'admin' });

    const res = await request(app)
      .post('/api/admin/users/bulk')
      .set(auth(actingAdmin))
      .send({ userIds: [otherAdmin._id.toString()], action: 'delete' });

    expect(res.status).toBe(200);
  });
});
