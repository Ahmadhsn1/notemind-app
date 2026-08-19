const request = require('supertest');

const app = require('../app');
const { startDb, stopDb, clearDb, createUser, auth } = require('./helpers');
const Template = require('../models/Template');

describe('custom note templates', () => {
  beforeAll(startDb);
  afterAll(stopDb);
  beforeEach(clearDb);

  describe('GET /templates (list)', () => {
    it('returns an empty list for a user with no templates', async () => {
      const user = await createUser();
      const res = await request(app).get('/api/templates').set(auth(user));

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('never returns another user\'s templates', async () => {
      const owner = await createUser();
      const stranger = await createUser();
      await Template.create({ user: owner._id, name: 'Owner template' });

      const res = await request(app).get('/api/templates').set(auth(stranger));
      expect(res.body).toEqual([]);
    });

    it('most recently updated first', async () => {
      const user = await createUser();
      const older = await Template.create({ user: user._id, name: 'Older' });
      const newer = await Template.create({ user: user._id, name: 'Newer' });
      // Force a real ordering gap rather than relying on creation-order luck.
      await Template.updateOne({ _id: older._id }, { updatedAt: new Date(Date.now() - 60_000) });
      await Template.updateOne({ _id: newer._id }, { updatedAt: new Date() });

      const res = await request(app).get('/api/templates').set(auth(user));
      expect(res.body.map((t) => t.name)).toEqual(['Newer', 'Older']);
    });
  });

  describe('POST /templates (create)', () => {
    it('creates a template from a name, title, and content', async () => {
      const user = await createUser();
      const res = await request(app).post('/api/templates').set(auth(user)).send({
        name: 'Standup notes',
        title: 'Daily standup',
        contentHtml: '<h2>Blockers</h2><p></p>',
      });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Standup notes');
      expect(res.body.title).toBe('Daily standup');
      expect(res.body.contentHtml).toContain('Blockers');
    });

    it('rejects a missing name', async () => {
      const user = await createUser();
      const res = await request(app).post('/api/templates').set(auth(user)).send({ contentHtml: '<p>x</p>' });
      expect(res.status).toBe(400);
    });

    it('strips disallowed HTML the same way notes do', async () => {
      const user = await createUser();
      const res = await request(app).post('/api/templates').set(auth(user)).send({
        name: 'Untrusted',
        contentHtml: '<p>safe</p><script>alert(1)</script>',
      });

      expect(res.status).toBe(201);
      expect(res.body.contentHtml).not.toContain('script');
      expect(res.body.contentHtml).toContain('safe');
    });

    it('defaults title and contentHtml to blank when omitted', async () => {
      const user = await createUser();
      const res = await request(app).post('/api/templates').set(auth(user)).send({ name: 'Blank-ish' });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('');
      expect(res.body.contentHtml).toBe('');
    });

    it('enforces a per-user cap so this can\'t become unbounded storage', async () => {
      const user = await createUser();
      await Template.insertMany(
        Array.from({ length: 60 }, (_, i) => ({ user: user._id, name: `Template ${i}` }))
      );

      const res = await request(app).post('/api/templates').set(auth(user)).send({ name: 'One too many' });
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /templates/:id (update)', () => {
    it('renames a template and updates its content', async () => {
      const user = await createUser();
      const template = await Template.create({ user: user._id, name: 'Old name', title: 'Old title' });

      const res = await request(app).put(`/api/templates/${template._id}`).set(auth(user)).send({
        name: 'New name',
        title: 'New title',
        contentHtml: '<p>updated</p>',
      });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('New name');
      expect(res.body.title).toBe('New title');
      expect(res.body.contentHtml).toContain('updated');
    });

    it('only touches fields actually present in the request', async () => {
      const user = await createUser();
      const template = await Template.create({ user: user._id, name: 'Keep me', title: 'Keep title too' });

      const res = await request(app).put(`/api/templates/${template._id}`).set(auth(user)).send({ name: 'Renamed only' });

      expect(res.body.name).toBe('Renamed only');
      expect(res.body.title).toBe('Keep title too');
    });

    it('refuses to update another user\'s template', async () => {
      const owner = await createUser();
      const stranger = await createUser();
      const template = await Template.create({ user: owner._id, name: 'Owner template' });

      const res = await request(app).put(`/api/templates/${template._id}`).set(auth(stranger)).send({ name: 'Hijacked' });
      expect(res.status).toBe(403);

      const stillOwners = await Template.findById(template._id);
      expect(stillOwners.name).toBe('Owner template');
    });

    it('404s for a template that doesn\'t exist', async () => {
      const user = await createUser();
      const res = await request(app).put('/api/templates/000000000000000000000000').set(auth(user)).send({ name: 'X' });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /templates/:id', () => {
    it('deletes an owned template', async () => {
      const user = await createUser();
      const template = await Template.create({ user: user._id, name: 'Delete me' });

      const res = await request(app).delete(`/api/templates/${template._id}`).set(auth(user));
      expect(res.status).toBe(200);
      expect(await Template.findById(template._id)).toBeNull();
    });

    it('refuses to delete another user\'s template', async () => {
      const owner = await createUser();
      const stranger = await createUser();
      const template = await Template.create({ user: owner._id, name: 'Owner template' });

      const res = await request(app).delete(`/api/templates/${template._id}`).set(auth(stranger));
      expect(res.status).toBe(403);
      expect(await Template.findById(template._id)).not.toBeNull();
    });
  });
});
