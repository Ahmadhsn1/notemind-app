const TurndownService = require('turndown');

// Configured once and reused — Turndown's default rule set already covers
// most of what sanitizeNoteHtml allows through, including <a href> (its
// built-in inlineLink rule) — plus three things unique to this app's editor:
// strikethrough (Tiptap's <s>, not in CommonMark), task lists (data-checked
// attribute, not a real HTML list type), and underline (<u> — Markdown has
// no native underline syntax at all, unlike strikethrough's ~~~~, so without
// a rule Turndown's default falls through to bare text and the underline is
// silently lost). Wikilink spans (see noteLinkExtension.js) have no custom
// rule — Turndown's default behavior for an unrecognized inline element is
// to keep its text content, which is exactly the linked note's title, so
// the export reads naturally without needing to resolve ids into a second
// note lookup.
const turndownService = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' });

turndownService.addRule('strikethrough', {
  filter: ['s', 'del', 'strike'],
  replacement: (content) => `~~${content}~~`,
});

// Raw HTML passthrough rather than emphasis (`_..._`) — Markdown has no
// underline syntax, and misusing italics would misrepresent the formatting.
// <u> is valid inline in the Markdown flavors this app's own reader
// (GitHub, most renderers) supports.
turndownService.addRule('underline', {
  filter: 'u',
  replacement: (content) => `<u>${content}</u>`,
});

turndownService.addRule('taskListItem', {
  filter: (node) => node.nodeName === 'LI' && node.parentNode?.getAttribute('data-type') === 'taskList',
  replacement: (content, node) => {
    const checked = node.getAttribute('data-checked') === 'true';
    return `- [${checked ? 'x' : ' '}] ${content.trim()}\n`;
  },
});

const htmlToMarkdown = (html) => turndownService.turndown(html || '');

module.exports = { htmlToMarkdown };
