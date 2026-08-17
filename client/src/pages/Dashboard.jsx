import {useState, useEffect, useCallback, useMemo} from 'react'
import {useLocation, useNavigate} from 'react-router-dom'
import api from '../api/axios'
import {fetchAllNotes, NOTES_PAGE_SIZE, MAX_NOTE_PAGES} from '../api/notes'
import {useAuth} from '../context/AuthContext'
import {useToast} from '../context/ToastContext'
import NoteCard from '../components/NoteCard'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import NoteFormModal from '../components/NoteFormModal'
import TemplatePickerModal from '../components/TemplatePickerModal'
import AskAIModal from '../components/AskAIModal'
import ConfirmModal from '../components/ConfirmModal'
import NoteViewModal from '../components/NoteViewModal'
import CommandPalette from '../components/CommandPalette'
import FlashcardReview from '../components/FlashcardReview'
import DigestWidget from '../components/DigestWidget'
import MomentumHero from '../components/MomentumHero'
import ResurfaceCard from '../components/ResurfaceCard'
import CursorSpotlight from '../components/CursorSpotlight'
import {legacyBodyToHtml} from '../utils/legacyBodyToHtml'
import {toLocalDateKey} from '../utils/dateKey'

// datetime-local inputs need "YYYY-MM-DDTHH:mm" in the browser's local time,
// not the ISO/UTC string the API stores — new Date(iso) already applies the
// local timezone via its getHours()/getDate() etc, so this is just padding.
const toDatetimeLocalValue = (isoString) => {
	if (!isoString) return ''
	const d = new Date(isoString)
	const pad = (n) => String(n).padStart(2, '0')
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function Dashboard() {
	const [notes, setNotes] = useState([])
	const [title, setTitle] = useState('')
	const [contentHtml, setContentHtml] = useState('')
	const [legacyBody, setLegacyBody] = useState('')
	const [bodyPlainText, setBodyPlainText] = useState('')
	const [tags, setTags] = useState('')
	const [folder, setFolder] = useState('General')
	const [reminderAt, setReminderAt] = useState('')
	const [editingId, setEditingId] = useState(null)
	const [isModalOpen, setIsModalOpen] = useState(false)
	const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false)
	const [searchQuery, setSearchQuery] = useState('')
	const [activeFolder, setActiveFolder] = useState('All')
	// Same toggle-off-on-repeat-click shape as selectedDay below (and the same
	// reason a tag click needs one: clicking a tag is a filter action, not a
	// navigation, so there has to be an obvious way back to "no tag filter"
	// other than reloading the page).
	const [activeTag, setActiveTag] = useState(null)
	// Set by clicking a day bar in MomentumHero's "Daily activity" chart —
	// ANDed with search/folder below, same as those two already combine.
	// Clicking the same bar again toggles it back to null (see the
	// onSelectDay handler passed to MomentumHero).
	const [selectedDay, setSelectedDay] = useState(null)
	const [sortMode, setSortMode] = useState('newest')
	const [viewMode, setViewMode] = useState('grid')
	const [isSidebarOpen, setIsSidebarOpen] = useState(false)
	const [isAskModalOpen, setIsAskModalOpen] = useState(false)
	const [viewingNoteId, setViewingNoteId] = useState(null)
	const [notesLoading, setNotesLoading] = useState(true)
	const [notesError, setNotesError] = useState('')
	const [semanticMatchIds, setSemanticMatchIds] = useState([])
	// 'active' | 'archived' | 'trash' — which note lifecycle state the main
	// list shows (Phase 4). Switching triggers a refetch since each is a
	// distinct server-side filter, not a client-side split of one list.
	const [view, setView] = useState('active')
	const [noteToPermanentlyDelete, setNoteToPermanentlyDelete] = useState(null)
	// updatedAt captured when editing started, plus a pending save payload —
	// together these back the optimistic-concurrency check in handleSubmit
	// (Phase 7): if the note changed elsewhere since editing began, the user
	// is warned before their edit can overwrite it.
	const [editingUpdatedAt, setEditingUpdatedAt] = useState(null)
	const [saveConflict, setSaveConflict] = useState(null)
	// null = closed; 'due' = global due-today queue; a note id = that note's
	// full deck (opened right after generating from NoteViewModal).
	const [flashcardReviewTarget, setFlashcardReviewTarget] = useState(null)
	// Gates the note form's submit path so a double-click can't create two
	// identical notes (or fire two PUTs, each writing its own version snapshot).
	const [isSaving, setIsSaving] = useState(false)
	// True only past the fan-out ceiling in api/notes.js. Surfaced rather than
	// hidden, because everything derived from the notes array (backlinks, the
	// graph, folder counts) is incomplete when it's set.
	const [notesTruncated, setNotesTruncated] = useState(false)

	const {user, logout} = useAuth()
	const toast = useToast()
	const location = useLocation()
	const navigate = useNavigate()

	// GET /notes is paginated server-side (bounded query rather than an
	// unbounded scan); fetchAllNotes follows that pagination to completion.
	// It must fetch ALL of them, not just the first page — backlinks, the
	// graph, folder counts and the command palette are all derived from this
	// array, so a partial list makes them wrong rather than merely short.
	// `view` (active/archived/trash) is read from closure so a refetch after
	// any mutation always reflects whichever list is currently open.
	// useCallback (not a plain function) so the handlers below that call it —
	// handleDelete, handleArchive, etc. — can themselves be memoized with a
	// stable dependency instead of "a fresh function every render," which is
	// what NoteCard's React.memo below actually needs to skip re-rendering.
	const fetchNotes = useCallback(async () => {
		const {notes: allNotes, truncated} = await fetchAllNotes({view})
		setNotes(allNotes)
		setNotesTruncated(truncated)
	}, [view])

	// Drives the loading/error UI (unlike the silent `fetchNotes` refetch used
	// after mutations). Shared by the mount/view-change effect and the Retry
	// button.
	const loadNotesWithStatus = async () => {
		setNotesLoading(true)
		setNotesError('')
		try {
			await fetchNotes()
		} catch {
			setNotesError('Could not load your notes.')
		} finally {
			setNotesLoading(false)
		}
	}

	// This project has no data-fetching library (React Query/SWR) — fetch-on-
	// mount-and-view-change + manual refetch-after-mutation is the established
	// pattern here.
	/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect -- loadNotesWithStatus is re-created each render by design; view is the only real trigger */
	useEffect(() => {
		loadNotesWithStatus()
	}, [view])
	/* eslint-enable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */

	// GraphView navigates here with { openNoteId } in route state after a
	// node click. Runs once notes are loaded (so the target is resolvable),
	// then clears the state so back/forward navigation or a later re-render
	// doesn't reopen it.
	/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect -- syncing to react-router's external navigation state, not derived local state; only re-run when loading finishes or the target id changes */
	useEffect(() => {
		if (notesLoading || !location.state?.openNoteId) return
		setViewingNoteId(location.state.openNoteId)
		navigate(location.pathname, {replace: true, state: {}})
	}, [notesLoading, location.state?.openNoteId])
	/* eslint-enable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */

	// Semantic search augmentation (Phase 3): the substring filter below stays
	// instant/unchanged; this debounced call adds notes that are relevant by
	// meaning even when they share no keywords with the query (e.g. searching
	// "trip to portugal" surfaces a note about "flying to Lisbon"). Silent on
	// failure — keyword search still works without it.
	/* eslint-disable react-hooks/set-state-in-effect -- debounced fetch driven by external input (search query), not derivable from render */
	useEffect(() => {
		if (searchQuery.trim().length < 3) {
			setSemanticMatchIds([])
			return
		}
		let ignore = false
		const timer = setTimeout(async () => {
			try {
				const response = await api.post('/notes/search', {query: searchQuery.trim()})
				if (!ignore) setSemanticMatchIds(response.data.noteIds)
			} catch {
				if (!ignore) setSemanticMatchIds([])
			}
		}, 400)
		return () => { ignore = true; clearTimeout(timer) }
	}, [searchQuery])
	/* eslint-enable react-hooks/set-state-in-effect */

	const folderNames = [...new Set(notes.map((note) => note.folder))]
	const existingFolders = folderNames.length > 0 ? folderNames : ['General']
	const folders = [
		{name: 'All', count: notes.length},
		...folderNames.map((name) => ({name, count: notes.filter((n) => n.folder === name).length})),
	]

	// Named noteTags, not tags — `tags` is already the note-form's
	// comma-separated tags input state above. Same per-render (not memoized)
	// computation as folders above — cheap enough at note-collection scale.
	const noteTagNames = [...new Set(notes.flatMap((note) => note.tags))].sort((a, b) => a.localeCompare(b))
	const noteTags = noteTagNames.map((name) => ({name, count: notes.filter((n) => n.tags.includes(name)).length}))

	// Memoized rather than recomputed every render — with a few hundred notes
	// loaded, filtering+sorting on every keystroke of the note editor (which
	// only changes unrelated form state, not `notes` itself) was measurable
	// input lag. Each only recomputes when its own actual inputs change.
	const filteredNotes = useMemo(() => notes.filter((note) => {
		const matchesSearch =
			searchQuery.trim() === '' ||
			note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
			note.body.toLowerCase().includes(searchQuery.toLowerCase()) ||
			semanticMatchIds.includes(note._id)
		const matchesFolder = activeFolder === 'All' || note.folder === activeFolder
		const matchesTag = !activeTag || note.tags.includes(activeTag)
		const matchesDay = !selectedDay || toLocalDateKey(note.createdAt) === selectedDay
		return matchesSearch && matchesFolder && matchesTag && matchesDay
	}), [notes, searchQuery, semanticMatchIds, activeFolder, activeTag, selectedDay])

	const sortedNotes = useMemo(() => [...filteredNotes].sort((a, b) => {
		if (sortMode === 'newest') return new Date(b.createdAt) - new Date(a.createdAt)
		if (sortMode === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt)
		return a.title.localeCompare(b.title)
	}), [filteredNotes, sortMode])

	// Pinned section is only meaningful in the active view — archived/trashed
	// notes are never pinned (server clears the flag on archive/delete).
	const pinnedNotes = useMemo(
		() => (view === 'active' ? sortedNotes.filter((n) => n.pinned) : []),
		[sortedNotes, view],
	)
	const unpinnedNotes = useMemo(
		() => (view === 'active' ? sortedNotes.filter((n) => !n.pinned) : sortedNotes),
		[sortedNotes, view],
	)

	const viewingIndex = viewingNoteId ? sortedNotes.findIndex((n) => n._id === viewingNoteId) : -1
	// Wikilink/backlink navigation (Phase 2) can target a note outside the
	// current folder/search filter, where it won't be in sortedNotes — fall
	// back to the full list so the modal still opens (prev/next just won't
	// have a meaningful position for it, same as viewing any single result).
	const viewingNote = viewingIndex >= 0
		? sortedNotes[viewingIndex]
		: (viewingNoteId ? notes.find((n) => n._id === viewingNoteId) : null)

	const resetForm = () => {
		setTitle('')
		setContentHtml('')
		setLegacyBody('')
		setBodyPlainText('')
		setTags('')
		setFolder(existingFolders[0])
		setReminderAt('')
	}

	const handleOpenNew = () => {
		setEditingId(null)
		resetForm()
		setIsTemplatePickerOpen(true)
	}

	const handleCloseTemplatePicker = () => setIsTemplatePickerOpen(false)

	const handleSelectTemplate = (template) => {
		setIsTemplatePickerOpen(false)
		setTitle(template.title)
		setContentHtml(template.contentHtml)
		setLegacyBody('')
		// Templates are fixed, trusted HTML (not user/AI input) — textContent
		// extraction just needs to mirror what NoteEditor's own getText() will
		// produce once the user starts typing, so the "Generate title" button's
		// bodyPlainText.trim() gate reflects the prefilled content immediately.
		const plainText = new DOMParser().parseFromString(template.contentHtml, 'text/html').body.textContent || ''
		setBodyPlainText(plainText)
		setIsModalOpen(true)
	}

	const handleOpenFlashcardsForNote = (noteId) => {
		setViewingNoteId(null)
		setFlashcardReviewTarget(noteId)
	}

	const handleOpenDueFlashcards = () => setFlashcardReviewTarget('due')
	const handleCloseFlashcards = () => setFlashcardReviewTarget(null)

	// useCallback with an empty dep array — every one of these only calls
	// setters (stable across renders) or reads its own `note` argument, no
	// closed-over state — so NoteCard's React.memo below sees the same
	// function on every render instead of a fresh one, which is what
	// actually lets it skip re-rendering.
	const handleEdit = useCallback((note) => {
		setEditingId(note._id)
		setTitle(note.title)
		// contentHtml state is what actually gets sent on save (see handleSubmit)
		// — NoteEditor's own legacyBody fallback only affects what's *displayed*
		// on mount, it never reports back to this state unless the user types.
		// Leaving this as note.contentHtml || '' meant saving a legacy
		// (body-only, no contentHtml) note without ever touching the editor —
		// e.g. just changing tags, folder, or (once reminders shipped) the
		// reminder — silently wiped its content, since the server applies
		// whatever contentHtml key is present, empty string included.
		setContentHtml(note.contentHtml || legacyBodyToHtml(note.body))
		setLegacyBody(note.contentHtml ? '' : note.body)
		setBodyPlainText(note.body)
		setTags(note.tags.join(', '))
		setFolder(note.folder)
		setReminderAt(toDatetimeLocalValue(note.reminderAt))
		setEditingUpdatedAt(note.updatedAt)
		setIsModalOpen(true)
	}, [])

	const handleContentChange = ({html, text}) => {
		setContentHtml(html)
		setBodyPlainText(text)
	}

	const handleCloseModal = () => {
		setIsModalOpen(false)
		setEditingId(null)
		setEditingUpdatedAt(null)
		resetForm()
	}

	const saveNote = async (noteData) => {
		try {
			if (editingId) {
				await api.put(`/notes/${editingId}`, noteData)
			} else {
				await api.post('/notes', noteData)
			}

			setIsModalOpen(false)
			setEditingId(null)
			setEditingUpdatedAt(null)
			resetForm()
			await fetchNotes()
			toast.success(editingId ? 'Note saved.' : 'Note created.')
		} catch (err) {
			// The server returns a field->message map for validation failures
			// (middleware/validate.js). Collapsing that into one generic string
			// meant a blank or over-long title just said "Could not save the
			// note", and retrying failed identically with no hint why.
			const fieldErrors = err?.response?.data?.errors
			const firstFieldError = fieldErrors && Object.values(fieldErrors)[0]
			toast.error(firstFieldError || err?.response?.data?.message || 'Could not save the note. Try again.')
		}
	}

	const handleSubmit = async (e) => {
		e.preventDefault()
		// Guards the whole submit path, including the freshness check below —
		// that extra GET widens the window in which a second click could fire
		// a duplicate create/update.
		if (isSaving) return
		setIsSaving(true)

		const noteData = {
			title,
			contentHtml,
			tags: tags.split(',').map((tag) => tag.trim()).filter((tag) => tag !== ''),
			folder: folder.trim() || 'General',
			reminderAt: reminderAt ? new Date(reminderAt).toISOString() : null,
		}

		try {
			// Optimistic-concurrency check (Phase 7): re-fetch the note's current
			// updatedAt right before saving and compare it to the value captured
			// when editing began. A mismatch means it changed elsewhere (another
			// tab, another device) since — warn before silently overwriting that.
			if (editingId && editingUpdatedAt) {
				try {
					const latest = await api.get(`/notes/${editingId}`)
					if (latest.data.updatedAt !== editingUpdatedAt) {
						setSaveConflict(noteData)
						return
					}
				} catch {
					// Freshness check itself failed (e.g. offline) — fall through and
					// let the save attempt itself surface the real error.
				}
			}

			await saveNote(noteData)
		} finally {
			// Also covers the conflict branch's early return, which hands off to
			// handleConfirmOverwrite via ConfirmModal (itself guarded).
			setIsSaving(false)
		}
	}

	const handleConfirmOverwrite = async () => {
		const noteData = saveConflict
		setSaveConflict(null)
		if (noteData) await saveNote(noteData)
	}

	const handleViewNote = useCallback((note) => {
		setViewingNoteId(note._id)
	}, [])

	// useCallback with an empty dep array, same reasoning as handleEdit et al.
	// above (see that comment) — this is passed to memo(NoteCard) as a tag-
	// click handler, so a fresh function identity every render would defeat
	// the memo for every card. Toggles like selectedDay: clicking the
	// already-active tag clears the filter instead of re-selecting it.
	const handleSelectTag = useCallback((tagName) => {
		setActiveTag((prev) => (prev === tagName ? null : tagName))
	}, [])

	// Closing the view modal before applying the filter — same "close, then
	// act" shape as handleOpenFlashcardsForNote below — because filtering the
	// list out from under a modal the user can't see it change would be
	// confusing, not because anything actually depends on the ordering.
	const handleSelectTagFromView = useCallback((tagName) => {
		setViewingNoteId(null)
		handleSelectTag(tagName)
	}, [handleSelectTag])

	const handleCloseView = () => {
		setViewingNoteId(null)
	}

	const handleEditFromView = (note) => {
		setViewingNoteId(null)
		handleEdit(note)
	}

	const handleNavigateView = (direction) => {
		if (viewingIndex === -1 || sortedNotes.length === 0) return
		const nextIndex = (viewingIndex + direction + sortedNotes.length) % sortedNotes.length
		setViewingNoteId(sortedNotes[nextIndex]._id)
	}

	// Soft delete now — reversible via Trash, so no confirm-before-trash
	// friction. ConfirmModal is reserved for the one truly irreversible
	// action: permanent delete from Trash (see below).
	const handleDelete = useCallback(async (note) => {
		try {
			await api.delete(`/notes/${note._id}`)
			await fetchNotes()
			toast.success('Moved to trash.')
		} catch {
			toast.error('Could not delete the note. Try again.')
		}
	}, [fetchNotes, toast])

	const handleRequestPermanentDelete = useCallback((note) => setNoteToPermanentlyDelete(note), [])
	const handleCancelPermanentDelete = () => setNoteToPermanentlyDelete(null)

	const handleConfirmPermanentDelete = async () => {
		if (!noteToPermanentlyDelete) return
		try {
			await api.delete(`/notes/${noteToPermanentlyDelete._id}/permanent`)
			setNoteToPermanentlyDelete(null)
			await fetchNotes()
			toast.success('Note permanently deleted.')
		} catch {
			toast.error('Could not delete the note. Try again.')
		}
	}

	const handleRestore = useCallback(async (note) => {
		try {
			await api.post(`/notes/${note._id}/restore`)
			await fetchNotes()
			toast.success('Note restored.')
		} catch {
			toast.error('Could not restore the note. Try again.')
		}
	}, [fetchNotes, toast])

	const handleTogglePin = useCallback(async (note) => {
		try {
			const response = await api.patch(`/notes/${note._id}/pin`)
			setNotes((prev) => prev.map((n) => (n._id === note._id ? response.data : n)))
		} catch {
			toast.error('Could not update pin. Try again.')
		}
	}, [toast])

	const handleArchive = useCallback(async (note) => {
		try {
			await api.patch(`/notes/${note._id}/archive`)
			await fetchNotes()
			toast.success('Note archived.')
		} catch {
			toast.error('Could not archive the note. Try again.')
		}
	}, [fetchNotes, toast])

	const handleUnarchive = useCallback(async (note) => {
		try {
			await api.patch(`/notes/${note._id}/unarchive`)
			await fetchNotes()
			toast.success('Note restored from archive.')
		} catch {
			toast.error('Could not unarchive the note. Try again.')
		}
	}, [fetchNotes, toast])

	const handleSummarize = useCallback(async (id) => {
		const response = await api.post(`/notes/${id}/ai-process`)
		setNotes((prev) => prev.map((n) => (n._id === id ? response.data : n)))
	}, [])

	return (
		<div className="flex h-screen">
			<CursorSpotlight />
			<Sidebar
				folders={folders}
				activeFolder={activeFolder}
				onSelectFolder={setActiveFolder}
				tags={noteTags}
				activeTag={activeTag}
				onSelectTag={handleSelectTag}
				onNewNote={handleOpenNew}
				onAskAI={() => setIsAskModalOpen(true)}
				onOpenFlashcards={handleOpenDueFlashcards}
				userName={user?.name}
				isAdmin={user?.role === 'admin'}
				onLogout={logout}
				isOpen={isSidebarOpen}
				onClose={() => setIsSidebarOpen(false)}
				view={view}
				onViewChange={setView}
			/>

			<main className="flex-1 min-w-0 h-screen overflow-y-auto p-[18px] min-[761px]:pt-6 min-[761px]:px-7 min-[761px]:pb-7 2xl:px-12">
				<TopBar
					searchQuery={searchQuery}
					onSearchChange={setSearchQuery}
					sortMode={sortMode}
					onSortChange={setSortMode}
					viewMode={viewMode}
					onViewChange={setViewMode}
					onOpenSidebar={() => setIsSidebarOpen(true)}
				/>

				{(selectedDay || activeTag) && (
					<div className="flex items-center gap-1.5 mb-4 -mt-2 flex-wrap">
						{selectedDay && (
							<span className="inline-flex items-center gap-1.5 bg-accent/30 text-accent text-[11px] font-medium py-[3px] pl-2.5 pr-1.5 rounded-full">
								{new Date(`${selectedDay}T00:00:00`).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
								<button
									type="button"
									onClick={() => setSelectedDay(null)}
									aria-label="Clear day filter"
									className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-accent/25 cursor-pointer"
								>×</button>
							</span>
						)}
						{activeTag && (
							<span className="inline-flex items-center gap-1.5 bg-accent/30 text-accent text-[11px] font-medium py-[3px] pl-2.5 pr-1.5 rounded-full">
								#{activeTag}
								<button
									type="button"
									onClick={() => setActiveTag(null)}
									aria-label="Clear tag filter"
									className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-accent/25 cursor-pointer"
								>×</button>
							</span>
						)}
					</div>
				)}

				{view === 'active' && !notesLoading && !notesError && (
					<MomentumHero
						notes={notes}
						selectedDay={selectedDay}
						onSelectDay={(day) => setSelectedDay((prev) => (prev === day ? null : day))}
					/>
				)}

				{view === 'active' && <ResurfaceCard onViewNote={handleViewNote} />}

				{view === 'active' && <DigestWidget onViewNote={handleViewNote} />}

				{/* Only ever shown past api/notes.js's fan-out ceiling. Everything
				    derived from the notes array is incomplete at that point, so
				    saying so is better than quietly showing a partial graph and
				    partial backlinks. */}
				{notesTruncated && !notesLoading && (
					<div className="rounded-[12px] border border-ink/15 bg-ink/6 px-4 py-3 text-[12.5px] text-ink/60">
						Showing your {(NOTES_PAGE_SIZE * MAX_NOTE_PAGES).toLocaleString()} most recent notes. Older ones aren&apos;t
						loaded, so backlinks and the graph may be incomplete.
					</div>
				)}

				{notesLoading ? (
					<div className={`grid gap-4 ${viewMode === 'list' ? 'grid-cols-1' : 'grid-cols-[repeat(auto-fill,minmax(268px,1fr))]'}`}>
						{[...Array(6)].map((_, i) => (
							<div key={i} className="h-[132px] rounded-[14px] bg-ink/5 border border-ink/8 animate-pulse" />
						))}
					</div>
				) : notesError ? (
					<div className="text-center text-ink/50 py-[70px] px-5">
						<h4 className="text-[15px] font-semibold text-danger-light mb-1.5">{notesError}</h4>
						<p className="text-[13px] mb-4">Check your connection and try again.</p>
						<button onClick={loadNotesWithStatus} className="btn-primary py-[9px] px-5 text-[13px]">Retry</button>
					</div>
				) : sortedNotes.length === 0 ? (
					<div className="text-center text-ink/50 py-[70px] px-5">
						<h4 className="text-[15px] font-semibold text-ink/70 mb-1.5">
							{view === 'trash' ? 'Trash is empty' : view === 'archived' ? 'No archived notes' : 'No notes match'}
						</h4>
						<p className="text-[13px]">
							{view === 'active'
								? 'Try a different folder or search term, or create your first note.'
								: 'Try a different folder or search term.'}
						</p>
					</div>
				) : (
					<div className="flex flex-col gap-6">
						{pinnedNotes.length > 0 && (
							<div className="flex flex-col gap-3">
								<div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-ink/40">
									<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.8 5.6L19 9.4l-5.2 1.9L12 17l-1.8-5.7L5 9.4l5.2-1.8L12 2Z" /></svg>
									Pinned
								</div>
								<div className={`grid gap-4 ${viewMode === 'list' ? 'grid-cols-1' : 'grid-cols-[repeat(auto-fill,minmax(268px,1fr))]'}`}>
									{pinnedNotes.map((note) => (
										<NoteCard
											key={note._id}
											note={note}
											view={view}
											onDelete={handleDelete}
											onEdit={handleEdit}
											onSummarize={handleSummarize}
											onView={handleViewNote}
											onTogglePin={handleTogglePin}
											onArchive={handleArchive}
											onUnarchive={handleUnarchive}
											onRestore={handleRestore}
											onPermanentDelete={handleRequestPermanentDelete}
											onSelectTag={handleSelectTag}
										/>
									))}
								</div>
							</div>
						)}

						<div className={`grid gap-4 ${viewMode === 'list' ? 'grid-cols-1' : 'grid-cols-[repeat(auto-fill,minmax(268px,1fr))]'}`}>
							{unpinnedNotes.map((note) => {
								const q = searchQuery.trim().toLowerCase()
								const matchedBySemanticSearch = q !== ''
									&& !note.title.toLowerCase().includes(q)
									&& !note.body.toLowerCase().includes(q)
									&& semanticMatchIds.includes(note._id)
								return (
									<NoteCard
										key={note._id}
										note={note}
										view={view}
										onDelete={handleDelete}
										onEdit={handleEdit}
										onSummarize={handleSummarize}
										onView={handleViewNote}
										onTogglePin={handleTogglePin}
										onArchive={handleArchive}
										onUnarchive={handleUnarchive}
										onRestore={handleRestore}
										onPermanentDelete={handleRequestPermanentDelete}
										matchedBySemanticSearch={matchedBySemanticSearch}
										onSelectTag={handleSelectTag}
									/>
								)
							})}
						</div>
					</div>
				)}
			</main>

			<CommandPalette
				notes={notes}
				folders={folders}
				onNewNote={handleOpenNew}
				onAskAI={() => setIsAskModalOpen(true)}
				onSelectFolder={setActiveFolder}
				onViewNote={handleViewNote}
				onLogout={logout}
				otherModalOpen={
					isModalOpen ||
					isTemplatePickerOpen ||
					isAskModalOpen ||
					!!viewingNoteId ||
					!!flashcardReviewTarget ||
					!!noteToPermanentlyDelete ||
					!!saveConflict
				}
			/>

			<TemplatePickerModal
				isOpen={isTemplatePickerOpen}
				onSelect={handleSelectTemplate}
				onClose={handleCloseTemplatePicker}
			/>

			<NoteFormModal
				isOpen={isModalOpen}
				isEditing={!!editingId}
				title={title}
				contentHtml={contentHtml}
				legacyBody={legacyBody}
				bodyPlainText={bodyPlainText}
				tags={tags}
				folder={folder}
				reminderAt={reminderAt}
				existingFolders={existingFolders}
				notes={notes}
				editingId={editingId}
				onTitleChange={setTitle}
				onContentChange={handleContentChange}
				onTagsChange={setTags}
				onFolderChange={setFolder}
				onReminderChange={setReminderAt}
				onSubmit={handleSubmit}
				onClose={handleCloseModal}
				isSaving={isSaving}
			/>

			<AskAIModal
				isOpen={isAskModalOpen}
				onClose={() => setIsAskModalOpen(false)}
				notes={notes}
				onActionApplied={fetchNotes}
			/>

			<NoteViewModal
				isOpen={!!viewingNoteId}
				note={viewingNote}
				notes={notes}
				onClose={handleCloseView}
				onEdit={handleEditFromView}
				onPrev={() => handleNavigateView(-1)}
				onNext={() => handleNavigateView(1)}
				onNavigateToNote={handleViewNote}
				onNoteChanged={fetchNotes}
				onOpenFlashcards={handleOpenFlashcardsForNote}
				onSelectTag={handleSelectTagFromView}
				currentIndex={viewingIndex}
				totalCount={sortedNotes.length}
			/>

			<FlashcardReview
				isOpen={!!flashcardReviewTarget}
				noteId={flashcardReviewTarget === 'due' ? null : flashcardReviewTarget}
				onClose={handleCloseFlashcards}
			/>

			<ConfirmModal
				isOpen={!!noteToPermanentlyDelete}
				title="Delete forever?"
				message={noteToPermanentlyDelete ? `"${noteToPermanentlyDelete.title}" will be permanently deleted. This can't be undone.` : ''}
				confirmLabel="Delete forever"
				onConfirm={handleConfirmPermanentDelete}
				onCancel={handleCancelPermanentDelete}
			/>

			<ConfirmModal
				isOpen={!!saveConflict}
				title="This note changed elsewhere"
				message="It looks like this note was updated somewhere else since you started editing. Saving now will overwrite those changes."
				confirmLabel="Overwrite"
				onConfirm={handleConfirmOverwrite}
				onCancel={() => setSaveConflict(null)}
			/>
		</div>
	)
}

export default Dashboard
