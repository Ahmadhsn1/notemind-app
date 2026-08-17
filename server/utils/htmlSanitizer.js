const sanitizeHtml = require('sanitize-html');

// Allowlist matches exactly what the Tiptap StarterKit + TaskList/TaskItem
// extensions on the client can produce. Anything else (script, style,
// iframe, event handler attrs, arbitrary style/class) is stripped rather
// than escaped, since this HTML is later rendered with
// dangerouslySetInnerHTML on the client.
//
// 'a' and 'u': StarterKit v3 bundles extension-link (autolink + paste-as-link
// on by default) and extension-underline, and NoteEditor.jsx disables
// neither — so the editor has always been able to produce both, silently
// stripped here until this fix. Keep this comment (and this list) honest the
// next time StarterKit's bundled extension set changes.
const ALLOWED_TAGS = [
  'p', 'br', 'hr', 'strong', 'em', 's', 'u', 'a', 'code', 'pre',
  'h1', 'h2', 'h3', 'blockquote',
  'ul', 'ol', 'li',
  'span', 'img',
];

const ALLOWED_ATTRIBUTES = {
  li: ['data-type', 'data-checked'],
  ul: ['data-type'],
  // [[wikilink]] nodes from the Mention-based editor extension — see
  // noteController's deriveContentFields, which parses data-note-id back
  // out of the sanitized HTML to populate Note.links.
  span: ['data-type', 'data-note-id'],
  img: ['src', 'alt'],
  // target/rel are what Tiptap's Link extension actually emits
  // (target="_blank" rel="noopener noreferrer nofollow" by default) —
  // unlisted attributes are dropped silently by sanitize-html, so omitting
  // these would keep the href but downgrade every link to same-tab with no
  // rel hardening.
  a: ['href', 'target', 'rel'],
};

// Anchors the src to exactly the shape POST /notes/upload-image generates
// (see uploadImage's `${userId}-${crypto.randomUUID()}.${ext}`) — a same-
// origin relative path, nothing else. This is what actually blocks an
// attacker-supplied `<img src="//evil.com/x.png">` or
// `<img src="http://evil.com/x.png">`; allowedSchemes/allowProtocolRelative
// below are defense-in-depth on top of it, not the primary guard, since
// sanitize-html's allowedSchemes check does NOT apply to protocol-relative
// URLs (allowProtocolRelative defaults to true independently of it).
const UPLOAD_IMAGE_SRC_PATTERN = /^\/uploads\/[A-Za-z0-9_-]+\.(png|jpe?g|gif|webp)$/;

const MAX_HTML_LENGTH = 200_000;

class HtmlTooLargeError extends Error {}

const sanitizeNoteHtml = (rawHtml) => {
  const html = typeof rawHtml === 'string' ? rawHtml : '';
  if (html.length > MAX_HTML_LENGTH) {
    throw new HtmlTooLargeError(`Note content exceeds ${MAX_HTML_LENGTH} characters`);
  }

  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    // Per-tag rather than the global `allowedSchemes` this used to be: img
    // src is never scheme-based (it's checked below by
    // UPLOAD_IMAGE_SRC_PATTERN instead — a bare relative path has no scheme
    // for allowedSchemes to even inspect), so a global allow-list of
    // http/https/mailto did nothing for images and would have quietly
    // widened as soon as a tag that DOES need a scheme (a) was added. Scoping
    // it to `a` keeps the img defense-in-depth comment above literally true.
    // Note a scheme-less relative href (e.g. "/dashboard") always passes
    // regardless of this list — sanitize-html's underlying `launder` check
    // treats "no scheme" as not-dangerous — which is intended, not a gap.
    allowedSchemesByTag: { a: ['http', 'https', 'mailto'] },
    // Still blocks a bare `href="//evil.test"` (no scheme, but a host) even
    // though it isn't caught by allowedSchemesByTag above — a separate check
    // in sanitize-html, and the other half of what makes an href safe.
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    exclusiveFilter: (frame) => frame.tag === 'img' && !UPLOAD_IMAGE_SRC_PATTERN.test(frame.attribs.src || ''),
  });
};

// Converts sanitized HTML into plain text for AI prompts / keyword search:
// block-level tags become newlines, list items get a leading "- ".
const htmlToPlainText = (html) => {
  const withBreaks = (html || '')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/(p|li|h1|h2|h3|blockquote|pre)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n');

  return sanitizeHtml(withBreaks, { allowedTags: [], allowedAttributes: {} })
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

module.exports = { sanitizeNoteHtml, htmlToPlainText, HtmlTooLargeError, MAX_HTML_LENGTH };
