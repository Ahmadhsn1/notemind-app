// Fixed HTML built from the exact tag set NoteEditor's Tiptap config (and the
// server's sanitizeNoteHtml allowlist) can already produce — h2/p/ul/li plus
// TaskList/TaskItem's data-type/data-checked markup — so a selected template
// round-trips through save/sanitize/reload with no special-casing anywhere
// else in the app.
//
// This array is the built-in, code-only set — not editable or deletable by a
// user. User-authored templates (create/rename/rewrite/delete, all through
// TemplatePickerModal's own "New template"/edit flow) are a separate,
// server-backed resource (server/models/Template.js, /api/templates) fetched
// at runtime, not added here.
export const NOTE_TEMPLATES = [
	{
		key: 'blank',
		label: 'Blank note',
		description: 'Start from nothing.',
		title: '',
		contentHtml: '',
	},
	{
		key: 'meeting',
		label: 'Meeting notes',
		description: 'Attendees, agenda, action items.',
		title: 'Meeting notes',
		contentHtml: `
			<h2>Attendees</h2>
			<p></p>
			<h2>Agenda</h2>
			<ul><li></li></ul>
			<h2>Notes</h2>
			<p></p>
			<h2>Action items</h2>
			<ul data-type="taskList">
				<li data-type="taskItem" data-checked="false"></li>
			</ul>
		`.replace(/\n\s*/g, ''),
	},
	{
		key: 'journal',
		label: 'Daily journal',
		description: 'A simple daily reflection prompt.',
		title: 'Daily journal',
		contentHtml: `
			<h2>How I'm feeling</h2>
			<p></p>
			<h2>What happened today</h2>
			<p></p>
			<h2>Grateful for</h2>
			<ul><li></li></ul>
		`.replace(/\n\s*/g, ''),
	},
	{
		key: 'weekly-review',
		label: 'Weekly review',
		description: 'Wins, misses, and next week’s focus.',
		title: 'Weekly review',
		contentHtml: `
			<h2>Wins this week</h2>
			<ul><li></li></ul>
			<h2>What didn't go well</h2>
			<ul><li></li></ul>
			<h2>Focus for next week</h2>
			<ul data-type="taskList">
				<li data-type="taskItem" data-checked="false"></li>
			</ul>
		`.replace(/\n\s*/g, ''),
	},
]
