import {useEffect, useMemo, useState} from 'react'
import DOMPurify from 'dompurify'
import api from '../api/axios'
import {withPendingImages, withSignedImages} from '../utils/noteImages'
import {useToast} from '../context/ToastContext'
import {folderColor} from '../utils/folderColor'
import {relativeTime} from '../utils/relativeTime'
import AdminNoteVersionsModal from './AdminNoteVersionsModal'

// Full read-only content view of one note, for admin moderation — shows
// everything (content, tags, folder, lifecycle state, reminder, AI summary,
// links) but has no edit control anywhere: admin can view and moderate a
// note's lifecycle (from AdminUserContentModal's row actions) but never
// rewrites its title/body/tags.
function AdminNoteDetailModal({noteId, onClose}) {
	const [note, setNote] = useState(null)
	const [showFlashcards, setShowFlashcards] = useState(false)
	const [flashcards, setFlashcards] = useState(null)
	const [showVersions, setShowVersions] = useState(false)
	const toast = useToast()

	useEffect(() => {
		if (!noteId) return
		let ignore = false
		;(async () => {
			try {
				const res = await api.get(`/admin/notes/${noteId}`)
				if (!ignore) setNote(res.data)
			} catch {
				if (!ignore) toast.error('Could not load this note.')
			}
		})()
		return () => { ignore = true }
		// eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only fetch, remounts fresh per open
	}, [noteId])

	// Same two-phase image resolution as NoteViewModal — see utils/noteImages.
	// Note that an admin viewing someone else's note will NOT get signed URLs
	// for it: sign-images only signs files the caller owns. That is deliberate
	// rather than an oversight — admin read access to note *text* is an
	// existing moderation capability, but silently minting image URLs for
	// another user's private files is a bigger step than this change should
	// take on its own.
	const pendingHtml = useMemo(() => {
		if (!note) return ''
		const html = note.contentHtml || `<p>${note.body || ''}</p>`
		return withPendingImages(DOMPurify.sanitize(html))
	}, [note])

	const [signedHtml, setSignedHtml] = useState(null)
	const [signedForHtml, setSignedForHtml] = useState(pendingHtml)
	if (signedForHtml !== pendingHtml) {
		setSignedForHtml(pendingHtml)
		setSignedHtml(null)
	}
	const safeHtml = signedHtml ?? pendingHtml

	useEffect(() => {
		let ignore = false
		withSignedImages(pendingHtml).then((resolved) => {
			if (!ignore) setSignedHtml(resolved)
		})
		return () => { ignore = true }
	}, [pendingHtml])

	const toggleFlashcards = async () => {
		const next = !showFlashcards
		setShowFlashcards(next)
		if (next && flashcards === null) {
			try {
				const res = await api.get(`/admin/notes/${noteId}/flashcards`)
				setFlashcards(res.data)
			} catch {
				toast.error('Could not load flashcards for this note.')
			}
		}
	}

	if (!noteId) return null

	return (
		<div
			className="fixed inset-0 bg-[#0a0b10]/65 backdrop-blur-[3px] flex items-center justify-center z-[35] p-4 min-[381px]:p-6"
			onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
		>
			<div className="w-full max-w-[520px] max-h-[85vh] bg-[linear-gradient(160deg,var(--color-panel-a),var(--color-panel-b))] border border-accent/35 rounded-[20px] p-4 min-[381px]:p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)] flex flex-col gap-3 overflow-y-auto">
				{!note ? (
					<div className="h-[160px] flex items-center justify-center text-ink/40 text-[13px]">Loading…</div>
				) : (
					<>
						<div className="flex items-start justify-between gap-2">
							<div className="flex items-center gap-2 min-w-0">
								<span className="w-2 h-2 rounded-full shrink-0" style={{background: folderColor(note.folder)}} />
								<h3 className="text-ink text-base font-bold break-words">{note.title}</h3>
							</div>
							<button
								onClick={onClose}
								aria-label="Close"
								className="w-7 h-7 p-0 shrink-0 rounded-[8px] bg-ink/6 border-none text-ink/62 text-xs font-semibold cursor-pointer transition-[opacity,transform] duration-200 hover:bg-ink/10 active:scale-[0.98]"
							>✕</button>
						</div>

						<div className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink/42">
							<span>{note.folder}</span>
							<span>· {relativeTime(note.createdAt)}</span>
							{note.pinned && <span className="py-[2px] px-2 rounded-full bg-accent/16 text-accent font-semibold">Pinned</span>}
							{note.archivedAt && <span className="py-[2px] px-2 rounded-full bg-ink/10 text-ink/50 font-semibold">Archived</span>}
							{note.deletedAt && <span className="py-[2px] px-2 rounded-full bg-danger/15 text-danger-light font-semibold">Trashed</span>}
						</div>

						{note.reminderAt && (
							<div className={`inline-flex items-center gap-1 self-start py-[3px] px-2 rounded-full text-[10.5px] font-semibold ${
								new Date(note.reminderAt) < new Date() ? 'bg-danger/20 text-danger-light' : 'bg-accent/16 text-accent'
							}`}>
								{new Date(note.reminderAt) < new Date() ? 'Overdue' : 'Due'} {new Date(note.reminderAt).toLocaleString(undefined, {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'})}
							</div>
						)}

						<div
							className="note-prose text-[13.5px] text-ink/70 max-h-[40vh] overflow-y-auto"
							dangerouslySetInnerHTML={{__html: safeHtml}}
						/>

						{note.tags.length > 0 && (
							<div className="flex flex-wrap gap-1.5">
								{note.tags.map((t) => <span key={t} className="bg-accent/30 text-accent text-[11px] py-[3px] px-2.5 rounded-full">{t}</span>)}
							</div>
						)}

						{note.aiSummary && (
							<div className="bg-gradient-to-br from-accent/12 to-growth/10 border border-accent/25 rounded-[10px] py-2.5 px-3 flex flex-col gap-1.5">
								<div className="text-[10.5px] font-bold tracking-[0.04em] text-accent uppercase">AI summary</div>
								<p className="text-[12.5px] text-ink/60 leading-[1.5]">{note.aiSummary}</p>
							</div>
						)}

						{note.links?.length > 0 && (
							<div className="text-[11.5px] text-ink/45">{note.links.length} linked note{note.links.length === 1 ? '' : 's'}</div>
						)}

						<div className="border-t border-ink/10 pt-2.5 flex items-center gap-4">
							<button
								onClick={() => setShowVersions(true)}
								className="flex items-center gap-1.5 text-[11.5px] font-semibold text-ink/50 cursor-pointer transition-colors duration-150 hover:text-ink/80"
							>Version history</button>
							<button
								onClick={toggleFlashcards}
								className="flex items-center gap-1.5 text-[11.5px] font-semibold text-ink/50 cursor-pointer transition-colors duration-150 hover:text-ink/80"
							>Flashcards{flashcards ? ` (${flashcards.length})` : ''}</button>
						</div>

						{showFlashcards && (
							<div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto">
								{flashcards === null ? (
									<p className="text-[12px] text-ink/40">Loading…</p>
								) : flashcards.length === 0 ? (
									<p className="text-[12px] text-ink/40">No flashcards generated from this note.</p>
								) : (
									flashcards.map((f) => (
										<div key={f._id} className="py-2 px-2.5 rounded-[8px] bg-ink/5 text-[12px]">
											<div className="font-semibold text-ink/75 truncate">{f.question}</div>
											<div className="text-ink/45 truncate">{f.answer}</div>
										</div>
									))
								)}
							</div>
						)}
					</>
				)}
			</div>

			{showVersions && (
				<AdminNoteVersionsModal noteId={noteId} noteTitle={note?.title} onClose={() => setShowVersions(false)} />
			)}
		</div>
	)
}

export default AdminNoteDetailModal
