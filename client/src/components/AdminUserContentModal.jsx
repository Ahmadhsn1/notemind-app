import {useEffect, useRef, useState} from 'react'
import api from '../api/axios'
import useModalA11y from '../hooks/useModalA11y'
import {useToast} from '../context/ToastContext'
import {relativeTime} from '../utils/relativeTime'
import {folderColor} from '../utils/folderColor'
import ConfirmModal from './ConfirmModal'
import AdminNoteDetailModal from './AdminNoteDetailModal'

const actionBtnClass = 'py-1 px-2 rounded-[6px] text-[11px] font-semibold cursor-pointer transition-[opacity,transform] duration-150 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap bg-ink/8 border border-ink/15 text-ink/70 hover:text-ink'
const dangerBtnClass = 'py-1 px-2 rounded-[6px] text-[11px] font-semibold cursor-pointer transition-[opacity,transform] duration-150 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap bg-danger/15 border border-danger/30 text-danger-light hover:bg-danger/25'

// Content-moderation view — replaces the old AdminNotesModal with full
// lifecycle visibility/control (archive/trash/restore/unpin, not just
// delete) plus a Flashcards sub-tab. Still never edits a note's actual
// content — see AdminNoteDetailModal for the view-only content viewer.
function AdminUserContentModal({userId, onClose, onNoteChanged}) {
	const [subTab, setSubTab] = useState('notes')
	const [notesData, setNotesData] = useState(null)
	const [flashcardsData, setFlashcardsData] = useState(null)
	const [deleteTarget, setDeleteTarget] = useState(null)
	const [deleteFlashcardTarget, setDeleteFlashcardTarget] = useState(null)
	const [actingId, setActingId] = useState(null)
	const [viewingNoteId, setViewingNoteId] = useState(null)
	const toast = useToast()

	const loadNotes = async () => {
		try {
			const res = await api.get(`/admin/users/${userId}/notes`)
			setNotesData(res.data)
		} catch {
			toast.error("Could not load this user's notes.")
		}
	}

	const loadFlashcards = async () => {
		try {
			const res = await api.get(`/admin/users/${userId}/flashcards`)
			setFlashcardsData(res.data)
		} catch {
			toast.error("Could not load this user's flashcards.")
		}
	}

	// Mount-once fetch for notes (default sub-tab); flashcards are lazy —
	// fetched the first time that sub-tab is opened, to avoid an unnecessary
	// request on every open of this modal. This component remounts fresh per
	// open (Admin.jsx conditionally mounts it), matching the old
	// AdminNotesModal's original pattern.
	/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect -- mount-only fetch, matches Admin.jsx's own loadAdminData pattern */
	useEffect(() => {
		loadNotes()
	}, [])
	/* eslint-enable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */

	// No isOpen prop — the parent only mounts this while a user is selected
	// (see Admin.jsx's own {contentUserId && <...>}), so a constant `true`
	// makes useModalA11y's "run once per open" effect fire on mount and
	// clean up on unmount, the equivalent transition here.
	const panelRef = useRef(null)
	useModalA11y(true, onClose, panelRef)

	const switchTab = (tab) => {
		setSubTab(tab)
		if (tab === 'flashcards' && flashcardsData === null) loadFlashcards()
	}

	if (!userId) return null

	const patchNote = (id, fields) => {
		setNotesData((prev) => ({...prev, notes: prev.notes.map((n) => (n._id === id ? {...n, ...fields} : n))}))
	}

	const runNoteAction = async (note, action) => {
		setActingId(note._id)
		try {
			const res = await api.patch(`/admin/notes/${note._id}/${action}`)
			patchNote(note._id, res.data)
			onNoteChanged?.(userId)
		} catch (err) {
			toast.error(err.response?.data?.message || 'Could not update note.')
		} finally {
			setActingId(null)
		}
	}

	const handleConfirmDeleteNote = async () => {
		if (!deleteTarget) return
		setActingId(deleteTarget._id)
		try {
			await api.delete(`/admin/notes/${deleteTarget._id}`)
			setNotesData((prev) => ({...prev, notes: prev.notes.filter((n) => n._id !== deleteTarget._id)}))
			toast.success(`"${deleteTarget.title}" was deleted.`)
			onNoteChanged?.(userId, {removed: true})
		} catch (err) {
			toast.error(err.response?.data?.message || 'Could not delete note.')
		} finally {
			setActingId(null)
			setDeleteTarget(null)
		}
	}

	const handleConfirmDeleteFlashcard = async () => {
		if (!deleteFlashcardTarget) return
		try {
			await api.delete(`/admin/flashcards/${deleteFlashcardTarget._id}`)
			setFlashcardsData((prev) => ({...prev, flashcards: prev.flashcards.filter((f) => f._id !== deleteFlashcardTarget._id)}))
			toast.success('Flashcard deleted.')
		} catch (err) {
			toast.error(err.response?.data?.message || 'Could not delete flashcard.')
		} finally {
			setDeleteFlashcardTarget(null)
		}
	}

	const userName = notesData?.user?.name || flashcardsData?.user?.name

	return (
		<div
			className="fixed inset-0 bg-[#0a0b10]/60 backdrop-blur-[3px] flex items-center justify-center z-30 p-4 min-[381px]:p-6"
			onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
		>
			<div
				ref={panelRef}
				role="dialog"
				aria-modal="true"
				aria-label={userName ? `${userName}'s content` : 'Content'}
				tabIndex={-1}
				className="w-full max-w-[600px] max-h-[80vh] bg-[linear-gradient(160deg,var(--color-panel-a),var(--color-panel-b))] border border-accent/35 rounded-[20px] p-4 min-[381px]:p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)] flex flex-col gap-3.5 outline-none"
			>
				<div className="flex items-center justify-between gap-2">
					<h3 className="text-base font-bold">{userName ? `${userName}'s content` : 'Content'}</h3>
					<button
						onClick={onClose}
						aria-label="Close"
						className="w-7 h-7 p-0 shrink-0 rounded-[8px] bg-ink/6 border-none text-ink/62 text-xs font-semibold cursor-pointer transition-[opacity,transform] duration-200 hover:bg-ink/10 active:scale-[0.98]"
					>✕</button>
				</div>

				<div className="flex gap-1.5">
					{[['notes', 'Notes'], ['flashcards', 'Flashcards']].map(([key, label]) => (
						<button
							key={key}
							onClick={() => switchTab(key)}
							className={`py-1.5 px-3 rounded-[8px] text-[12px] font-semibold cursor-pointer transition-colors ${
								subTab === key ? 'bg-accent/22 text-accent border border-accent/40' : 'bg-ink/6 border border-ink/12 text-ink/60 hover:text-ink'
							}`}
						>{label}</button>
					))}
				</div>

				<div className="overflow-y-auto flex flex-col gap-1.5">
					{subTab === 'notes' && (
						!notesData ? (
							<div className="h-[120px] flex items-center justify-center text-ink/40 text-[13px]">Loading…</div>
						) : notesData.notes.length === 0 ? (
							<div className="h-[120px] flex items-center justify-center text-ink/40 text-[13px]">No notes yet.</div>
						) : (
							notesData.notes.map((n) => {
								const isTrashed = !!n.deletedAt
								const isArchived = !!n.archivedAt && !isTrashed
								const acting = actingId === n._id
								return (
									<div key={n._id} className="flex flex-col gap-1.5 py-2.5 px-3 rounded-[10px] bg-ink/5 border border-ink/10">
										<div className="flex items-center gap-2.5">
											<span className="w-2 h-2 rounded-full shrink-0" style={{background: folderColor(n.folder)}} />
											<div className="min-w-0 flex-1">
												<div className="text-[13px] font-semibold truncate flex items-center gap-1.5">
													{n.title}
													{n.pinned && <span className="text-[10px] font-bold uppercase tracking-[0.04em] text-accent">Pinned</span>}
													{isArchived && <span className="text-[10px] font-bold uppercase tracking-[0.04em] text-ink/45">Archived</span>}
													{isTrashed && <span className="text-[10px] font-bold uppercase tracking-[0.04em] text-danger-light">Trashed</span>}
												</div>
												<div className="text-[11px] text-ink/45">{n.folder} · updated {relativeTime(n.updatedAt)}</div>
											</div>
										</div>
										<div className="flex flex-wrap gap-1.5">
											<button onClick={() => setViewingNoteId(n._id)} className={actionBtnClass}>View</button>
											{n.pinned && (
												<button onClick={() => runNoteAction(n, 'unpin')} disabled={acting} className={actionBtnClass}>Unpin</button>
											)}
											{isTrashed ? (
												<>
													<button onClick={() => runNoteAction(n, 'restore')} disabled={acting} className={actionBtnClass}>Restore</button>
													<button onClick={() => setDeleteTarget(n)} disabled={acting} className={dangerBtnClass}>Delete forever</button>
												</>
											) : isArchived ? (
												<>
													<button onClick={() => runNoteAction(n, 'unarchive')} disabled={acting} className={actionBtnClass}>Unarchive</button>
													<button onClick={() => runNoteAction(n, 'trash')} disabled={acting} className={actionBtnClass}>Trash</button>
												</>
											) : (
												<>
													<button onClick={() => runNoteAction(n, 'archive')} disabled={acting} className={actionBtnClass}>Archive</button>
													<button onClick={() => runNoteAction(n, 'trash')} disabled={acting} className={actionBtnClass}>Trash</button>
												</>
											)}
										</div>
									</div>
								)
							})
						)
					)}

					{subTab === 'flashcards' && (
						!flashcardsData ? (
							<div className="h-[120px] flex items-center justify-center text-ink/40 text-[13px]">Loading…</div>
						) : flashcardsData.flashcards.length === 0 ? (
							<div className="h-[120px] flex items-center justify-center text-ink/40 text-[13px]">No flashcards yet.</div>
						) : (
							flashcardsData.flashcards.map((f) => (
								<div key={f._id} className="flex flex-col gap-1 py-2.5 px-3 rounded-[10px] bg-ink/5 border border-ink/10">
									<div className="flex items-start justify-between gap-2">
										<div className="min-w-0 flex-1">
											<div className="text-[13px] font-semibold truncate">{f.question}</div>
											<div className="text-[12px] text-ink/55 truncate">{f.answer}</div>
										</div>
										<button onClick={() => setDeleteFlashcardTarget(f)} className={dangerBtnClass}>Delete</button>
									</div>
									<div className="text-[11px] text-ink/40 flex flex-wrap gap-x-2.5">
										{f.note?.title && <span>from "{f.note.title}"</span>}
										<span>due {relativeTime(f.dueDate)}</span>
										<span>interval {f.interval}d</span>
										<span>reps {f.repetitions}</span>
										<span>ease {f.easeFactor.toFixed(2)}</span>
									</div>
								</div>
							))
						)
					)}
				</div>
			</div>

			<ConfirmModal
				isOpen={!!deleteTarget}
				title="Delete this note forever?"
				message={deleteTarget ? `"${deleteTarget.title}" will be permanently deleted, including its version history and any flashcards generated from it.` : ''}
				confirmLabel="Delete forever"
				onConfirm={handleConfirmDeleteNote}
				onCancel={() => setDeleteTarget(null)}
			/>
			<ConfirmModal
				isOpen={!!deleteFlashcardTarget}
				title="Delete this flashcard?"
				message={deleteFlashcardTarget ? `"${deleteFlashcardTarget.question}" will be permanently deleted.` : ''}
				confirmLabel="Delete"
				onConfirm={handleConfirmDeleteFlashcard}
				onCancel={() => setDeleteFlashcardTarget(null)}
			/>
			{viewingNoteId && <AdminNoteDetailModal noteId={viewingNoteId} onClose={() => setViewingNoteId(null)} />}
		</div>
	)
}

export default AdminUserContentModal
