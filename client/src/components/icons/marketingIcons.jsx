// Shared by Landing.jsx and Features.jsx (both public marketing pages) so
// the same concept — e.g. "sparkles" meaning AI — never has two visually
// different icons drifting apart between pages. Moved out of Landing.jsx,
// where this originated, when Features.jsx needed the same set plus more.
//
// Data only, no component — matches editor/icons.jsx's convention (and
// avoids react-refresh/only-export-components, which fires on a file that
// mixes a component export with plain data). Each consuming page defines
// its own tiny local `Icon` wrapper around these paths, same as
// NoteEditor.jsx does with editor/icons.jsx's SPARKLE_PATH/TOOLBAR_ICON.
export const ICONS = {
	// Two four-point stars. An earlier version drew four separate radiating
	// strokes plus a small diamond, which at 14–20px just read as a plus sign.
	sparkles: <><path d="M10.5 3l1.7 4.8L17 9.5l-4.8 1.7L10.5 16l-1.7-4.8L4 9.5l4.8-1.7z" /><path d="M17.5 14l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z" /></>,
	tag: <><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2A2 2 0 0 1 3 12V4a1 1 0 0 1 1-1h8a2 2 0 0 1 1.4.6l7.2 7.2a2 2 0 0 1 0 2.6Z" /><circle cx="7.5" cy="7.5" r="1.2" /></>,
	cards: <><rect x="3" y="7" width="13" height="14" rx="2" /><path d="M8 3h11a2 2 0 0 1 2 2v11" /></>,
	graph: <><circle cx="6" cy="7" r="2.5" /><circle cx="18" cy="7" r="2.5" /><circle cx="12" cy="18" r="2.5" /><path d="M8 8.5 10.5 16M16 8.5 13.5 16M8.5 7h7" /></>,
	history: <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v4h4" /><path d="M12 8v4l3 2" /></>,
	offline: <><path d="M12 3v12" /><path d="M8 11l4 4 4-4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></>,
	check: <path d="m5 13 4 4L19 7" />,
	shield: <><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /><path d="m9 12 2 2 4-4" /></>,
	lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
	download: <><path d="M12 3v12" /><path d="m7 11 5 4 5-4" /><path d="M4 20h16" /></>,
	noAds: <><circle cx="12" cy="12" r="9" /><path d="m5.6 5.6 12.8 12.8" /></>,
	// Added for Features.jsx's fuller category list.
	search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m20 20-4.3-4.3" /></>,
	folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />,
	// Same silhouette as NoteCard.jsx's PIN_PATH — deliberately identical so
	// "pin" reads the same wherever a user has already seen it in the app.
	pin: <><path d="M9 4h6l-.6 5.2L18 13v2H6v-2l3.6-3.8L9 4Z" /><path d="M12 15v5" /></>,
	link: <><path d="M9 15l6-6" /><path d="M11 5l1-1a4 4 0 0 1 6 6l-1 1" /><path d="M13 19l-1 1a4 4 0 0 1-6-6l1-1" /></>,
	// Same silhouette as NoteCard.jsx's BELL_PATH.
	bell: <><path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
	mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>,
	streak: <path d="M12 2c1.2 2.8-2.6 4-2.6 7.6a2.6 2.6 0 0 0 5.2 0c0-.8-.3-1.5-.7-2 .6 1.8 3.1 3 3.1 6a5 5 0 0 1-10 0c0-4.5 3.3-5.6 3.3-9.4 0-.8.3-1.6 1.7-2.2Z" />,
	calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
	theme: <><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></>,
	pencil: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
	// A device/monitor, for "install as an app" — deliberately distinct from
	// `offline`'s tray-arrow shape even though both are used in the same
	// "Wherever you are" section on Features.jsx.
	device: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>,
}
