const request = require('supertest');

const app = require('../app');
const { startDb, stopDb, clearDb, createUser, createNote, auth } = require('./helpers');
const { sanitizeNoteHtml, htmlToPlainText } = require('../utils/htmlSanitizer');

// Note bodies are rendered with dangerouslySetInnerHTML on the client, so
// this allowlist is the only thing standing between a crafted note and script
// execution in the author's own session (where the token lives in
// sessionStorage). It had no test at all.
describe('HTML sanitization', () => {
  const mustStrip = [
    ['inline script', '<p>ok</p><script>alert(1)</script>'],
    ['event handler', '<p onclick="alert(1)">ok</p>'],
    ['javascript: href', '<a href="javascript:alert(1)">click</a>'],
    ['iframe', '<iframe src="https://evil.test"></iframe>'],
    ['svg with script', '<svg><script>alert(1)</script></svg>'],
    ['object embed', '<object data="evil.swf"></object>'],
    ['style with expression', '<div style="background:url(javascript:alert(1))">x</div>'],
    ['form', '<form action="https://evil.test"><input name="p"></form>'],
    ['meta refresh', '<meta http-equiv="refresh" content="0;url=https://evil.test">'],
  ];

  for (const [name, html] of mustStrip) {
    it(`strips ${name}`, () => {
      const clean = sanitizeNoteHtml(html);
      expect(clean).not.toMatch(/<script|onclick|javascript:|<iframe|<object|<form|http-equiv/i);
    });
  }

  it('keeps the formatting the editor legitimately produces', () => {
    const html = '<h2>Title</h2><p><strong>bold</strong> <em>italic</em> <s>struck</s></p><ul><li>item</li></ul>';
    expect(sanitizeNoteHtml(html)).toBe(html);
  });

  it('rejects an external image src (only generated upload paths are allowed)', () => {
    const clean = sanitizeNoteHtml('<img src="https://evil.test/track.png">');
    expect(clean).not.toMatch(/evil\.test/);
  });

  it('derives plain text without markup for AI prompts and keyword search', () => {
    expect(htmlToPlainText('<p>hello <strong>world</strong></p>')).toMatch(/hello world/);
    expect(htmlToPlainText('<p>hi</p>')).not.toMatch(/</);
  });
});

// Sanitization has to hold end-to-end, not just in the unit above — the write
// path is what actually persists.
describe('sanitization on write', () => {
  beforeAll(startDb);
  afterAll(stopDb);
  beforeEach(clearDb);

  it('stores a note with the script stripped', async () => {
    const user = await createUser();
    const res = await request(app)
      .post('/api/notes')
      .set(auth(user))
      .send({ title: 'x', contentHtml: '<p>safe</p><script>alert(1)</script>' });

    expect(res.status).toBe(201);
    expect(res.body.contentHtml).toContain('safe');
    expect(res.body.contentHtml).not.toMatch(/<script/i);
  });
});

// `VIEW_FILTERS[req.query.view]` was a truthiness check on a plain object, so
// ?view=constructor resolved truthy, spread to nothing, and returned active,
// archived AND trashed notes in a single response.
describe('note view filter', () => {
  beforeAll(startDb);
  afterAll(stopDb);
  beforeEach(clearDb);

  const listCount = async (user, view) => {
    const res = await request(app).get(`/api/notes${view ? `?view=${view}` : ''}`).set(auth(user));
    expect(res.status).toBe(200);
    return res.body.total;
  };

  it('does not let a prototype key bypass the lifecycle filter', async () => {
    const user = await createUser();
    await createNote(user, { title: 'active' });
    await createNote(user, { title: 'trashed', deletedAt: new Date() });
    await createNote(user, { title: 'archived', archivedAt: new Date() });

    expect(await listCount(user, 'active')).toBe(1);
    expect(await listCount(user, 'trash')).toBe(1);
    expect(await listCount(user, 'archived')).toBe(1);

    for (const probe of ['constructor', 'toString', 'valueOf', '__proto__', 'hasOwnProperty']) {
      expect(await listCount(user, probe)).toBe(1); // falls back to active
    }
  });
});

// archiveNote set archivedAt without clearing deletedAt, so archiving a
// trashed note left both set — excluding it from the active view AND the
// archived view, leaving it visible only in Trash where the 30-day purge then
// destroyed it.
describe('archive/trash mutual exclusion', () => {
  beforeAll(startDb);
  afterAll(stopDb);
  beforeEach(clearDb);

  it('refuses to archive a trashed note', async () => {
    const user = await createUser();
    const note = await createNote(user, { deletedAt: new Date() });

    const res = await request(app).patch(`/api/notes/${note._id}/archive`).set(auth(user));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/trash/i);
  });

  it('clears archivedAt when trashing, so both are never set at once', async () => {
    const user = await createUser();
    const note = await createNote(user, { archivedAt: new Date() });

    await request(app).delete(`/api/notes/${note._id}`).set(auth(user)).expect(200);

    const Note = require('../models/Note');
    const reloaded = await Note.findById(note._id);
    expect(reloaded.deletedAt).not.toBeNull();
    expect(reloaded.archivedAt).toBeNull();
  });

  it('refuses via the admin route too', async () => {
    const admin = await createUser({ role: 'admin' });
    const user = await createUser();
    const note = await createNote(user, { deletedAt: new Date() });

    const res = await request(app).patch(`/api/admin/notes/${note._id}/archive`).set(auth(admin));
    expect(res.status).toBe(400);
  });
});

// Uncapped input on the AI routes meant a 1MB question (the express.json
// ceiling) went verbatim into a billed Gemini prompt.
describe('AI input limits', () => {
  beforeAll(startDb);
  afterAll(stopDb);
  beforeEach(clearDb);

  it('rejects an over-long question, empty question and over-long search', async () => {
    const user = await createUser();

    const long = await request(app).post('/api/notes/ask').set(auth(user)).send({ question: 'a'.repeat(2001) });
    expect(long.status).toBe(400);

    const empty = await request(app).post('/api/notes/ask').set(auth(user)).send({ question: '' });
    expect(empty.status).toBe(400);

    const search = await request(app).post('/api/notes/search').set(auth(user)).send({ query: 'b'.repeat(501) });
    expect(search.status).toBe(400);
  });

  it('caps tags and folder length on note writes', async () => {
    const user = await createUser();

    const tags = await request(app).post('/api/notes').set(auth(user))
      .send({ title: 'x', tags: Array.from({ length: 51 }, (_, i) => `t${i}`) });
    expect(tags.status).toBe(400);

    const folder = await request(app).post('/api/notes').set(auth(user))
      .send({ title: 'x', folder: 'f'.repeat(81) });
    expect(folder.status).toBe(400);
  });
});
