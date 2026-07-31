const archiver = require('archiver');
const Note = require('../models/Note');
const { htmlToMarkdown } = require('../utils/markdownConverter');

// Strips characters that are unsafe/awkward across filesystems and appends a
// short id suffix — titles collide constantly in practice (this account alone
// has several notes literally titled "sss"/"ss"), so the suffix is load-bearing,
// not decorative.
const safeMarkdownFilename = (title, id) => {
  const base = (title || 'untitled')
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60) || 'untitled';
  return `${base} (${id.toString().slice(-6)}).md`;
};

// Shared by the self-service export routes (/api/notes/export/*, scoped to
// req.user.id) and the admin per-user export (/api/admin/users/:id/export/*,
// scoped to an admin-specified userId) — same query/format logic either way,
// just a different source for which user's notes to pull. A real backup, not
// just "the current view" — includes archived/trashed notes with their state
// flags intact.
const buildUserNotesExport = async (userId, format, res) => {
  const notes = await Note.find({ user: userId })
    .select('-embedding')
    .sort({ createdAt: 1 });

  const exportDate = new Date().toISOString().slice(0, 10);

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="notemind-export-${exportDate}.json"`);
    res.status(200).json({
      exportedAt: new Date().toISOString(),
      noteCount: notes.length,
      notes,
    });
    return;
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="notemind-export-${exportDate}.zip"`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  // Errors from the archiver stream arrive via this event, not as a rejected
  // promise — throwing here would be an uncaught exception in an event
  // callback, not something the controller's own async/await could catch.
  archive.on('error', (err) => {
    console.error('Export archive error:', err);
    if (!res.headersSent) res.status(500).json({ message: 'Export failed' });
    else res.end();
  });
  archive.pipe(res);

  const usedNames = new Set();
  for (const note of notes) {
    let filename = safeMarkdownFilename(note.title, note._id);
    while (usedNames.has(filename)) filename = filename.replace(/\.md$/, '-dup.md');
    usedNames.add(filename);

    const frontMatter = [
      '---',
      `title: ${JSON.stringify(note.title)}`,
      `folder: ${JSON.stringify(note.folder)}`,
      `tags: [${note.tags.map((t) => JSON.stringify(t)).join(', ')}]`,
      `createdAt: ${note.createdAt.toISOString()}`,
      `updatedAt: ${note.updatedAt.toISOString()}`,
      '---',
      '',
    ].join('\n');

    const markdown = htmlToMarkdown(note.contentHtml) || note.body || '';
    archive.append(`${frontMatter}${markdown}\n`, { name: filename });
  }

  await archive.finalize();
};

module.exports = { buildUserNotesExport, safeMarkdownFilename };
