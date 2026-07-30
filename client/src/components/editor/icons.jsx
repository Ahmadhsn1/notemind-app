// Shared between NoteEditor's toolbar and the slash-command menu so both
// surfaces render identical icons for the same block types.
export const SPARKLE_PATH = <path d="M12 2l1.8 5.6L19 9.4l-5.2 1.9L12 17l-1.8-5.7L5 9.4l5.2-1.8L12 2Z" />

export const TOOLBAR_ICON = {
	bold: <path d="M6 4h5.5a3.5 3.5 0 0 1 0 7H6zM6 11h6a3.5 3.5 0 0 1 0 7H6z" />,
	italic: <path d="M11 4h6M5 20h6M14 4 8 20" />,
	strike: <path d="M6 12h12M8 6.5c1-1 2.5-1.5 4-1.5 2.5 0 4.5 1 4.5 3S16 8 12 8M8 17.5c1 1 2.5 1.5 4 1.5 2.5 0 4.5-1 4.5-3" />,
	h2: <path d="M4 6v12M11 6v12M4 12h7M15 9.5c0-1.5 1.2-2.5 2.5-2.5S20 8 20 9.5c0 1.5-1 2-2.5 3.4L15 18h5" />,
	bulletList: <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />,
	orderedList: <path d="M9 6h11M9 12h11M9 18h11M4 5v3M4 8h1M4.2 13.5c.6-.7 1.8-.7 2.2 0 .4.7-.1 1.2-.8 1.8l-1.4 1.2h2.4" />,
	taskList: <path d="M4 6h2l1 1 2-2M4 12h2l1 1 2-2M4 18h2l1 1 2-2M12 6h9M12 12h9M12 18h9" />,
	quote: <path d="M7 8c-1.7 0-3 1.3-3 3v3h4v-4H6a2 2 0 0 1 2-2zM16 8c-1.7 0-3 1.3-3 3v3h4v-4h-2a2 2 0 0 1 2-2z" />,
	codeBlock: <path d="M8 9 5 12l3 3M16 9l3 3-3 3M13.5 6.5l-3 11" />,
	mic: <><rect x="9" y="2" width="6" height="11" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 19v3M9 22h6" /></>,
	image: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m3 15 4.5-4.5a2 2 0 0 1 2.8 0L15 15" /><path d="m14 14 1.5-1.5a2 2 0 0 1 2.8 0L21 15" /><circle cx="8.5" cy="8.5" r="1.5" /></>,
}
