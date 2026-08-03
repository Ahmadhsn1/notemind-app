const request = require('supertest');

const app = require('../app');
const { startDb, stopDb, clearDb, createUser, createNote, auth } = require('./helpers');
const Note = require('../models/Note');
const NoteVersion = require('../models/NoteVersion');
const Flashcard = require('../models/Flashcard');
const Resurface = require('../models/Resurface');
const Notification = require('../models/Notification');
const { purgeNotes, purgeUsers } = require('../services/dataCleanup');

// Builds a note with every kind of dependent record hanging off it, so a
// cascade that misses one collection fails loudly.
const seedNoteWithDependents = async (user, overrides = {}) => {
  const note = await createNote(user, overrides);
  await NoteVersion.create({ note: note._id, title: 'old', contentHtml: '<p>old</p>', body: 'old' });
  await Flashcard.create({ user: user._id, note: note._id, question: 'q', answer: 'a' });
  await Resurface.create({ user: user._id, date: '2026-01-01', oldNote: note._id, method: 'semantic' });
  return note;
};

const countsFor = async (noteId) => ({
  notes: await Note.countDocuments({ _id: noteId }),
  versions: await NoteVersion.countDocuments({ note: noteId }),
  flashcards: await Flashcard.countDocuments({ note: noteId }),
  danglingResurface: await Resurface.countDocuments({ oldNote: noteId }),
});

// There were six independent delete paths and no two cleaned up the same
// collections. The user-visible symptom was flashcards that kept quizzing you
// on notes you had permanently deleted, and account deletion that left
// reflection history and uploaded images behind. Every path now funnels
// through services/dataCleanup, and each is asserted separately here because
// "they all call the same helper" is exactly the property that silently
// regresses.
describe('note deletion cascades', () => {
  beforeAll(startDb);
  afterAll(stopDb);
  beforeEach(clearDb);

  it('purgeNotes removes versions, flashcards and dangling resurface refs', async () => {
    const user = await createUser();
    const note = await seedNoteWithDependents(user);

    await purgeNotes([note._id]);

    expect(await countsFor(note._id)).toEqual({ notes: 0, versions: 0, flashcards: 0, danglingResurface: 0 });
  });

  it('permanent delete leaves no orphaned flashcards', async () => {
    const user = await createUser();
    const note = await seedNoteWithDependents(user, { deletedAt: new Date() });

    const res = await request(app).delete(`/api/notes/${note._id}/permanent`).set(auth(user));
    expect(res.status).toBe(200);

    expect(await countsFor(note._id)).toEqual({ notes: 0, versions: 0, flashcards: 0, danglingResurface: 0 });
  });

  it('the 30-day trash purge cascades too (it was a bare deleteMany)', async () => {
    const user = await createUser();
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const note = await seedNoteWithDependents(user, { deletedAt: old });

    // purgeExpiredTrash runs lazily when the trash view is listed.
    const res = await request(app).get('/api/notes?view=trash').set(auth(user));
    expect(res.status).toBe(200);

    expect(await countsFor(note._id)).toEqual({ notes: 0, versions: 0, flashcards: 0, danglingResurface: 0 });
  });

  it('admin note deletion cascades', async () => {
    const admin = await createUser({ role: 'admin' });
    const user = await createUser();
    const note = await seedNoteWithDependents(user);

    const res = await request(app).delete(`/api/admin/notes/${note._id}`).set(auth(admin));
    expect(res.status).toBe(200);

    expect(await countsFor(note._id)).toEqual({ notes: 0, versions: 0, flashcards: 0, danglingResurface: 0 });
  });

  it('preserves the reflection streak when a resurfaced note is deleted', async () => {
    const user = await createUser();
    const note = await createNote(user);
    await Resurface.create({
      user: user._id, date: '2026-01-01', oldNote: note._id, method: 'semantic', engagedAt: new Date(),
    });

    await purgeNotes([note._id]);

    // The record survives with engagedAt intact (so the streak is unaffected)
    // but becomes a coherent no-memory day rather than a dangling reference.
    const doc = await Resurface.findOne({ user: user._id, date: '2026-01-01' });
    expect(doc).not.toBeNull();
    expect(doc.engagedAt).not.toBeNull();
    expect(doc.oldNote).toBeNull();
    expect(doc.method).toBe('none');
  });

  it('removes the deleted note id from other notes wikilinks', async () => {
    const user = await createUser();
    const target = await createNote(user, { title: 'Target' });
    const linker = await createNote(user, { title: 'Linker', links: [target._id] });

    await purgeNotes([target._id]);

    const reloaded = await Note.findById(linker._id);
    expect(reloaded.links.map(String)).not.toContain(target._id.toString());
  });
});

describe('account deletion cascades', () => {
  beforeAll(startDb);
  afterAll(stopDb);
  beforeEach(clearDb);

  it('purgeUsers removes notes, versions, flashcards and resurface history', async () => {
    const user = await createUser();
    await seedNoteWithDependents(user);

    await purgeUsers([user._id]);

    expect(await Note.countDocuments({ user: user._id })).toBe(0);
    expect(await Flashcard.countDocuments({ user: user._id })).toBe(0);
    expect(await Resurface.countDocuments({ user: user._id })).toBe(0);
    expect(await NoteVersion.countDocuments({})).toBe(0);
  });

  it('pulls the user out of shared notifications rather than orphaning the reference', async () => {
    const admin = await createUser({ role: 'admin' });
    const leaving = await createUser();
    const staying = await createUser();

    const notification = await Notification.create({
      message: 'hello',
      createdBy: admin._id,
      recipients: [leaving._id, staying._id],
      readBy: [leaving._id],
    });

    await purgeUsers([leaving._id]);

    const reloaded = await Notification.findById(notification._id);
    expect(reloaded.recipients.map(String)).toEqual([staying._id.toString()]);
    expect(reloaded.readBy.map(String)).toEqual([]);
  });

  it('deletes a broadcast once it has no recipients left', async () => {
    const admin = await createUser({ role: 'admin' });
    const only = await createUser();
    const notification = await Notification.create({
      message: 'just you', createdBy: admin._id, recipients: [only._id], readBy: [],
    });

    await purgeUsers([only._id]);

    expect(await Notification.findById(notification._id)).toBeNull();
  });

  it('leaves other users data untouched', async () => {
    const leaving = await createUser();
    const staying = await createUser();
    await seedNoteWithDependents(leaving);
    const keptNote = await seedNoteWithDependents(staying);

    await purgeUsers([leaving._id]);

    expect(await Note.countDocuments({ user: staying._id })).toBe(1);
    expect(await NoteVersion.countDocuments({ note: keptNote._id })).toBe(1);
    expect(await Flashcard.countDocuments({ note: keptNote._id })).toBe(1);
  });
});
