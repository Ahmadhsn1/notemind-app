const request = require('supertest');

const app = require('../app');
const { startDb, stopDb, clearDb, createUser, auth } = require('./helpers');
const { signFilename, verifySignature } = require('../services/imageSignature');

const fileFor = (user, name = 'aaaa-bbbb') => `${user._id.toString()}-${name}.png`;

// /uploads can't require an Authorization header (an <img> tag can't send
// one), so authorisation moved to a signature: the protected sign-images
// endpoint decides who may access what, and the public route only verifies.
describe('image signatures', () => {
  it('verifies a signature it just produced', () => {
    const { exp, sig } = signFilename('user-file.png');
    expect(verifySignature('user-file.png', exp, sig)).toBe(true);
  });

  it('is bound to the filename — a signature cannot be reused for another file', () => {
    const { exp, sig } = signFilename('one.png');
    expect(verifySignature('two.png', exp, sig)).toBe(false);
  });

  it('is bound to the expiry — extending it invalidates the signature', () => {
    const { exp, sig } = signFilename('one.png');
    expect(verifySignature('one.png', exp + 3600, sig)).toBe(false);
  });

  it('rejects an expired signature', () => {
    const { sig } = signFilename('one.png', -10);
    const expiredExp = Math.floor(Date.now() / 1000) - 10;
    expect(verifySignature('one.png', expiredExp, sig)).toBe(false);
  });

  it('rejects missing, malformed and tampered signatures', () => {
    const { exp } = signFilename('one.png');
    for (const bad of [undefined, '', 'not-a-signature', 'x'.repeat(43)]) {
      expect(verifySignature('one.png', exp, bad)).toBe(false);
    }
    expect(verifySignature('one.png', 'not-a-number', 'abc')).toBe(false);
  });
});

describe('POST /notes/sign-images', () => {
  beforeAll(startDb);
  afterAll(stopDb);
  beforeEach(clearDb);

  it('signs a file the caller owns', async () => {
    const user = await createUser();
    const filename = fileFor(user);

    const res = await request(app).post('/api/notes/sign-images').set(auth(user)).send({ filenames: [filename] });

    expect(res.status).toBe(200);
    expect(res.body.signed[filename]).toMatch(/^\/uploads\/.+\?exp=\d+&sig=.+$/);
  });

  // The filename carries its owner's id, which is what makes this check
  // possible without a per-image database lookup.
  it('refuses to sign a file belonging to someone else', async () => {
    const owner = await createUser();
    const attacker = await createUser();
    const filename = fileFor(owner);

    const res = await request(app).post('/api/notes/sign-images').set(auth(attacker)).send({ filenames: [filename] });

    expect(res.status).toBe(200);
    expect(res.body.signed[filename]).toBeUndefined();
  });

  it('ignores traversal attempts and junk instead of failing the batch', async () => {
    const user = await createUser();
    const good = fileFor(user);

    const res = await request(app).post('/api/notes/sign-images').set(auth(user)).send({
      filenames: ['../../etc/passwd', '..%2Fsecret.png', 'a/b.png', 42, null, good],
    });

    expect(res.status).toBe(200);
    expect(Object.keys(res.body.signed)).toEqual([good]);
  });

  it('requires a session', async () => {
    expect((await request(app).post('/api/notes/sign-images').send({ filenames: [] })).status).toBe(401);
  });
});

describe('GET /uploads/:filename', () => {
  beforeAll(startDb);
  afterAll(stopDb);
  beforeEach(clearDb);

  // Previously this route was an unauthenticated express.static mount: any
  // URL worked for anyone, forever.
  it('refuses an unsigned request', async () => {
    const user = await createUser();
    const res = await request(app).get(`/uploads/${fileFor(user)}`);
    expect(res.status).toBe(403);
  });

  it('refuses a tampered signature', async () => {
    const user = await createUser();
    const filename = fileFor(user);
    const { exp } = signFilename(filename);

    const res = await request(app).get(`/uploads/${filename}?exp=${exp}&sig=forged`);
    expect(res.status).toBe(403);
  });

  it('refuses an expired signature', async () => {
    const user = await createUser();
    const filename = fileFor(user);
    const { exp, sig } = signFilename(filename, -10);

    const res = await request(app).get(`/uploads/${filename}?exp=${exp}&sig=${sig}`);
    expect(res.status).toBe(403);
  });

  it('accepts a valid signature (404 only because no file is on disk)', async () => {
    const user = await createUser();
    const filename = fileFor(user);
    const { exp, sig } = signFilename(filename);

    const res = await request(app).get(`/uploads/${filename}?exp=${exp}&sig=${sig}`);
    // Past the signature check — the file itself was never written in this test.
    expect(res.status).toBe(404);
  });

  it('rejects a traversal attempt before doing anything else', async () => {
    const res = await request(app).get('/uploads/..%2F..%2Fetc%2Fpasswd');
    expect([400, 403, 404]).toContain(res.status);
    expect(res.text).not.toMatch(/root:/);
  });
});
