const sanitizeHtml = require('sanitize-html');

// Allowlist matches exactly what the Tiptap StarterKit + TaskList/TaskItem
// extensions on the client can produce. Anything else (script, style,
// iframe, event handler attrs, arbitrary style/class) is stripped rather
// than escaped, since this HTML is later rendered with
// dangerouslySetInnerHTML on the client.
const ALLOWED_TAGS = [
  'p', 'br', 'hr', 'strong', 'em', 's', 'code', 'pre',
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
    allowedSchemes: [],
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
