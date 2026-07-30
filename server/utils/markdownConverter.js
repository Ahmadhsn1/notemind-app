const TurndownService = require('turndown');

// Configured once and reused — Turndown's default rule set already covers
// everything sanitizeNoteHtml allows through except the two things unique
// to this app's editor: strikethrough (Tiptap's <s>, not in CommonMark) and
// task lists (data-checked attribute, not a real HTML list type). Wikilink
// spans (see noteLinkExtension.js) have no custom rule — Turndown's default
// behavior for an unrecognized inline element is to keep its text content,
// which is exactly the linked note's title, so the export reads naturally
// without needing to resolve ids into a second note lookup.
const turndownService = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' });

turndownService.addRule('strikethrough', {
  filter: ['s', 'del', 'strike'],
  replacement: (content) => `~~${content}~~`,
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
