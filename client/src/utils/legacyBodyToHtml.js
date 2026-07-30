const escapeHtml = (text) =>
	text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Notes created before the rich editor only have a plain-text `body`.
// Wraps it into paragraphs (blank line = new paragraph, single newline =
// line break) so it initializes the Tiptap editor / renders the same way
// rich notes do.
export function legacyBodyToHtml(body) {
	if (!body || !body.trim()) return ''

	return body
		.split(/\n{2,}/)
		.map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
		.join('')
}
