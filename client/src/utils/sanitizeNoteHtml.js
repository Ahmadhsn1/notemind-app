import DOMPurify from 'dompurify'

// Thin wrapper around the three DOMPurify.sanitize(note.contentHtml) call
// sites (NoteViewModal, AdminNoteDetailModal, AdminNoteVersionsModal) —
// defense in depth against any future write path that might skip the
// server's own sanitizeNoteHtml (server/utils/htmlSanitizer.js).
//
// DOMPurify's default allowlist already includes `a`/`u`/`href`/`rel`, but
// NOT `target` — so without this, a link's target="_blank" (which the
// server now preserves, see htmlSanitizer.js's ALLOWED_ATTRIBUTES.a) gets
// silently dropped here, and clicking a note link navigates the whole SPA
// away in place instead of opening a new tab.
export const sanitizeNoteHtml = (html) => DOMPurify.sanitize(html, {ADD_ATTR: ['target']})
