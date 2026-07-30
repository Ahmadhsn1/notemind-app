import CodeBlock from '@tiptap/extension-code-block'

// Stock CodeBlock.parseHTML() matches any bare <pre> in pasted HTML,
// regardless of what's inside it. Several everyday sources (Apple Notes,
// Slack, Mail) wrap plain text in <pre> purely to preserve whitespace, not
// to mark it as code — pasting from those silently swallowed the whole
// paste into one giant code block. Genuine code copied from an editor/GitHub
// always nests a <code> element inside the <pre>, so require that here;
// anything else falls through to normal paragraph parsing instead.
//
// addInputRules() is dropped entirely (stock CodeBlock auto-converts the
// current line to a code block the moment you type ``` followed by a space
// or newline) — same "never surprise the user" reasoning as the paste fix
// above: typing a stray ``` while taking notes shouldn't silently swallow
// what you're writing into a monospace box. The toolbar button and
// `toggleCodeBlock()` still work fine — those are commands, not input
// rules, and are untouched by this override.
export const strictCodeBlockExtension = CodeBlock.extend({
	addInputRules() {
		return []
	},
	parseHTML() {
		return [
			{
				tag: 'pre',
				preserveWhitespace: 'full',
				getAttrs: (node) => (node.querySelector('code') ? {} : false),
			},
		]
	},
})
