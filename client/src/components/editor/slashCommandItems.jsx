import {TOOLBAR_ICON, SPARKLE_PATH} from './icons'

// `run` receives (editor, range) — range is the "/query" text the Suggestion
// plugin is tracking, which every item must delete before applying its own
// change (otherwise the literal "/query" text is left behind in the note).
const BLOCK_ITEMS = [
	{key: 'heading', title: 'Heading', icon: TOOLBAR_ICON.h2, run: (editor, range) => editor.chain().focus().deleteRange(range).toggleHeading({level: 2}).run()},
	{key: 'bulletList', title: 'Bullet list', icon: TOOLBAR_ICON.bulletList, run: (editor, range) => editor.chain().focus().deleteRange(range).toggleBulletList().run()},
	{key: 'orderedList', title: 'Numbered list', icon: TOOLBAR_ICON.orderedList, run: (editor, range) => editor.chain().focus().deleteRange(range).toggleOrderedList().run()},
	{key: 'taskList', title: 'Checklist', icon: TOOLBAR_ICON.taskList, run: (editor, range) => editor.chain().focus().deleteRange(range).toggleTaskList().run()},
	{key: 'quote', title: 'Quote', icon: TOOLBAR_ICON.quote, run: (editor, range) => editor.chain().focus().deleteRange(range).toggleBlockquote().run()},
	{key: 'codeBlock', title: 'Code block', icon: TOOLBAR_ICON.codeBlock, run: (editor, range) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run()},
]

// `aiContinueRef` points at NoteEditor's `runAssist('continue')` closure —
// reused so the slash-triggered version gets the exact same loading/error
// UX as the toolbar sparkle button, instead of a second AI-request codepath.
export function getSlashCommandItems(query, aiContinueRef) {
	const items = [
		...BLOCK_ITEMS,
		{
			key: 'aiContinue',
			title: 'Continue writing with AI',
			icon: SPARKLE_PATH,
			fill: true,
			run: (editor, range) => {
				editor.chain().focus().deleteRange(range).run()
				aiContinueRef.current?.()
			},
		},
	]

	const q = query.toLowerCase()
	return items.filter((item) => item.title.toLowerCase().includes(q))
}
