import {useEffect, useMemo, useState} from 'react'
import DOMPurify from 'dompurify'
import api from '../api/axios'
import {useToast} from '../context/ToastContext'
import {folderColor} from '../utils/folderColor'
import {relativeTime} from '../utils/relativeTime'
import {legacyBodyToHtml} from '../utils/legacyBodyToHtml'
import {withPendingImages, withSignedImages} from '../utils/noteImages'

function NoteViewModal({isOpen, note, notes, onClose, onEdit, onPrev, onNext, onNavigateToNote, onNoteChanged, onOpenFlashcards, currentIndex, totalCount}) {
	const [showVersions, setShowVersions] = useState(false)
	const [versions, setVersions] = useState([])
	const [versionsLoading, setVersionsLoading] = useState(false)
	const [restoringId, setRestoringId] = useState(null)
	const [versionsForNoteId, setVersionsForNoteId] = useState(note?._id)
	const [generatingFlashcards, setGeneratingFlashcards] = useState(false)
	const toast = useToast()

	// Collapsed and refetched fresh each time a different note is opened — no
	// note-keyed cache needed at this scale, and it keeps stale version lists
	// from a previously-viewed note from ever being shown. Reset during
	// render (React's recommended "adjusting state when a prop changes"
	// pattern) rather than in an effect, since it's just re-deriving local
	// state from the note id, not synchronizing with anything external.
	if (note?._id !== versionsForNoteId) {
		setVersionsForNoteId(note?._id)
		setShowVersions(false)
		setVersions([])
	}

	useEffect(() => {
		if (!isOpen) return

		const handleKeyDown = (e) => {
			if (e.key === 'ArrowLeft') onPrev()
			else if (e.key === 'ArrowRight') onNext()
			else if (e.key === 'Escape') onClose()
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [isOpen, onPrev, onNext, onClose])

	const loadVersions = async () => {
		if (!note) return
		setVersionsLoading(true)
		try {
			const response = await api.get(`/notes/${note._id}/versions`)
			setVersions(response.data)
		} catch {
			toast.error('Could not load version history.')
		} finally {
			setVersionsLoading(false)
		}
	}

	const toggleVersions = () => {
		const next = !showVersions
		setShowVersions(next)
		if (next && versions.length === 0) loadVersions()
	}

	// No confirm dialog — restoring snapshots the current (pre-restore) state
	// into the version list first (server-side), so it's itself undoable the
	// same way, matching this app's "reversible actions don't need a confirm
	// step" convention (see Dashboard's soft-delete).
	const handleRestoreVersion = async (versionId) => {
		if (!note) return
		setRestoringId(versionId)
		try {
			await api.post(`/notes/${note._id}/versions/${versionId}/restore`)
			await onNoteChanged?.()
			await loadVersions()
			toast.success('Version restored.')
		} catch {
			toast.error('Could not restore that version. Try again.')
		} finally {
			setRestoringId(null)
		}
	}

	// Generates a batch of cards from the note's current content, then hands
	// off to Dashboard's FlashcardReview modal (scoped to this note) to
	// review them immediately — generation and review are separate API
	// resources but one continuous action from the user's perspective.
	const handleGenerateFlashcards = async () => {
		if (!note) return
		setGeneratingFlashcards(true)
		try {
			const response = await api.post(`/notes/${note._id}/flashcards`)
			toast.success(`${response.data.length} flashcards generated.`)
			onOpenFlashcards?.(note._id)
		} catch {
			toast.error('Could not generate flashcards. Try again.')
		} finally {
			setGeneratingFlashcards(false)
		}
	}

	// Server already sanitizes contentHtml before it's stored, but this is
	// user-controlled markup rendered via dangerouslySetInnerHTML — sanitize
	// again client-side as defense in depth against any future write path
	// that might skip the server sanitizer.
	// Phase one, synchronous: sanitize and park each /uploads/ src behind a
	// placeholder. Images can't be resolved here because they now need a
	// server-signed URL, and signing is a network call.
	const pendingHtml = useMemo(() => {
		if (!note) return ''
		const html = note.contentHtml || legacyBodyToHtml(note.body)
		return withPendingImages(DOMPurify.sanitize(html))
	}, [note])

	// Phase two: swap in signed URLs once they arrive. `signedHtml` is cleared
	// during render whenever the note changes (the same "adjust state when a
	// prop changes" pattern used for versionsForNoteId above) rather than in
	// the effect, so the displayed HTML is derived and there's no cascading
	// render. `ignore` stops a slow signing response for a previously-viewed
	// note from overwriting the one now on screen.
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

	// Outgoing: notes this one references via [[wikilink]] (note.links, IDs
	// only — resolved to title/existence here since a linked note could since
	// have been deleted). Incoming: notes whose own links array points back
	// at this one. Both derived from the already-loaded `notes` array — no
	// extra request, same approach as CommandPalette's note search.
	const outgoingLinks = useMemo(() => {
		if (!note || !notes) return []
		return (note.links || [])
			.map((id) => notes.find((n) => n._id === id))
			.filter(Boolean)
	}, [note, notes])

	const backlinks = useMemo(() => {
		if (!note || !notes) return []
		return notes.filter((n) => n._id !== note._id && (n.links || []).includes(note._id))
	}, [note, notes])

	const handleProseClick = (e) => {
		const linkEl = e.target.closest('[data-note-id]')
		if (!linkEl || !notes || !onNavigateToNote) return
		const target = notes.find((n) => n._id === linkEl.getAttribute('data-note-id'))
		if (target) onNavigateToNote(target)
	}

	if (!isOpen || !note) return null

	const hasMultiple = totalCount > 1
	// Fixed side buttons only fit without overlapping the card on wide viewports —
	// the card spans nearly the full screen width below the 761px breakpoint used
	// elsewhere in this app, so mobile gets an inline prev/next row instead (below).
	const navBtnBase = 'hidden min-[761px]:flex fixed top-1/2 -translate-y-1/2 w-10 h-10 p-0 rounded-full items-center justify-center bg-ink-deep/55 border border-ink/15 text-ink/62 cursor-pointer transition-[opacity,transform] duration-200 hover:bg-accent/22 hover:text-accent active:scale-[0.98] z-20'
	const inlineNavBtnBase = 'w-7 h-7 p-0 shrink-0 rounded-[8px] flex items-center justify-center bg-ink-deep/55 border border-ink/15 text-ink/62 cursor-pointer transition-[opacity,transform] duration-200 hover:bg-accent/22 hover:text-accent active:scale-[0.98]'

	return (
		<div
			className="fixed inset-0 bg-[#0a0b10]/60 backdrop-blur-[3px] flex items-center justify-center z-20 p-4 min-[381px]:p-6"
			onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
		>
			{hasMultiple && (
				<button onClick={onPrev} aria-label="Previous note" title="Previous note (←)" className={`${navBtnBase} left-4`}>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
				</button>
			)}
			{hasMultiple && (
				<button onClick={onNext} aria-label="Next note" title="Next note (→)" className={`${navBtnBase} right-4`}>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
				</button>
			)}

			<div className="w-full max-w-[480px] bg-[linear-gradient(160deg,var(--color-panel-a),var(--color-panel-b))] border border-accent/35 rounded-[20px] p-4 min-[381px]:p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)] flex flex-col gap-3">
				<div className="flex items-start justify-between gap-2">
					<div className="flex items-center gap-2 min-w-0">
						<span className="w-2 h-2 rounded-full shrink-0" style={{background: folderColor(note.folder)}} />
						<h3 className="text-ink text-base font-bold break-words">{note.title}</h3>
					</div>
					<button
						onClick={onClose}
						aria-label="Close"
						className="w-7 h-7 p-0 shrink-0 rounded-[8px] bg-ink/6 border-none text-ink/62 text-xs font-semibold cursor-pointer transition-[opacity,transform] duration-200 hover:bg-ink/10 hover:opacity-100 active:scale-[0.98]"
					>✕</button>
				</div>

				<div className="text-[11px] text-ink/42">{note.folder} · {relativeTime(note.createdAt)}</div>

				{note.reminderAt && (
					<div className={`inline-flex items-center gap-1 self-start py-[3px] px-2 rounded-full text-[10.5px] font-semibold ${
						new Date(note.reminderAt) < new Date() ? 'bg-danger/20 text-danger-light' : 'bg-accent/16 text-accent'
					}`}>
						<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>
						{new Date(note.reminderAt) < new Date() ? 'Overdue' : 'Due'} {new Date(note.reminderAt).toLocaleString(undefined, {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'})}
					</div>
				)}

				{hasMultiple && (
					<div className="hidden min-[761px]:flex text-[11px] text-ink/42 items-center gap-1.5 -mt-1.5">
						<span>{currentIndex + 1} of {totalCount}</span>
						<span className="text-ink/25">·</span>
						<span>use ← → to browse other notes</span>
					</div>
				)}

				{hasMultiple && (
					<div className="flex min-[761px]:hidden items-center justify-between -mt-1.5">
						<button onClick={onPrev} aria-label="Previous note" className={inlineNavBtnBase}>
							<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
						</button>
						<span className="text-[11px] text-ink/42">{currentIndex + 1} of {totalCount}</span>
						<button onClick={onNext} aria-label="Next note" className={inlineNavBtnBase}>
							<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
						</button>
					</div>
				)}

				<div
					className="note-prose text-[13.5px] text-ink/70 max-h-[50vh] overflow-y-auto"
					onClick={handleProseClick}
					dangerouslySetInnerHTML={{__html: safeHtml}}
				/>

				{(outgoingLinks.length > 0 || backlinks.length > 0) && (
					<div className="flex flex-col gap-2 pt-1 border-t border-ink/10">
						{outgoingLinks.length > 0 && (
							<div className="flex flex-wrap items-center gap-1.5">
								<span className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-ink/35">Links to</span>
								{outgoingLinks.map((n) => (
									<button
										key={n._id}
										onClick={() => onNavigateToNote?.(n)}
										className="py-[3px] px-2.5 rounded-full text-[11px] font-medium bg-accent/16 text-accent cursor-pointer transition-colors duration-150 hover:bg-accent/26"
									>{n.title}</button>
								))}
							</div>
						)}
						{backlinks.length > 0 && (
							<div className="flex flex-wrap items-center gap-1.5">
								<span className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-ink/35">Linked from</span>
								{backlinks.map((n) => (
									<button
										key={n._id}
										onClick={() => onNavigateToNote?.(n)}
										className="py-[3px] px-2.5 rounded-full text-[11px] font-medium bg-ink/8 text-ink/70 cursor-pointer transition-colors duration-150 hover:bg-ink/14 hover:text-ink"
									>{n.title}</button>
								))}
							</div>
						)}
					</div>
				)}

				{note.tags.length > 0 && (
					<div className="flex flex-wrap gap-1.5">
						{note.tags.map((t) => <span key={t} className="bg-accent/30 text-accent text-[11px] py-[3px] px-2.5 rounded-full">{t}</span>)}
					</div>
				)}

				{note.aiSummary && (
					<div className="bg-gradient-to-br from-accent/12 to-growth/10 border border-accent/25 rounded-[10px] py-2.5 px-3 flex flex-col gap-1.5">
						<div className="flex items-center gap-[5px] text-[10.5px] font-bold tracking-[0.04em] text-accent uppercase">
							<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.8 5.6L19 9.4l-5.2 1.9L12 17l-1.8-5.7L5 9.4l5.2-1.8L12 2Z" /></svg>
							AI summary
						</div>
						<p className="text-[12.5px] text-ink/60 leading-[1.5]">{note.aiSummary}</p>
					</div>
				)}

				<div className="border-t border-ink/10 pt-2.5 flex items-center justify-between gap-2">
					<button
						onClick={toggleVersions}
						className="flex items-center gap-1.5 text-[11.5px] font-semibold text-ink/50 cursor-pointer transition-colors duration-150 hover:text-ink/80"
					>
						<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-150 ${showVersions ? 'rotate-90' : ''}`}><path d="M9 18l6-6-6-6" /></svg>
						Version history
					</button>
					<button
						onClick={handleGenerateFlashcards}
						disabled={generatingFlashcards}
						className="flex items-center gap-1.5 text-[11.5px] font-semibold text-accent cursor-pointer transition-opacity duration-150 hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
					>
						<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={generatingFlashcards ? 'animate-[spin_0.9s_linear_infinite]' : ''}><rect x="3" y="5" width="14" height="10" rx="2" /><path d="M8 20h9" /><path d="M13 15v5" /></svg>
						{generatingFlashcards ? 'Generating…' : 'Flashcards'}
					</button>
				</div>

				{showVersions && (
					<div className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto">
						{versionsLoading ? (
							<p className="text-[12px] text-ink/40">Loading…</p>
						) : versions.length === 0 ? (
							<p className="text-[12px] text-ink/40">No earlier versions yet — edits create one automatically.</p>
						) : (
							versions.map((v) => (
								<div key={v._id} className="flex items-center justify-between gap-2 py-1.5 px-2.5 rounded-[8px] bg-ink/5">
									<span className="text-[12px] text-ink/60 truncate">{relativeTime(v.createdAt)} · {v.title}</span>
									<button
										onClick={() => handleRestoreVersion(v._id)}
										disabled={restoringId !== null}
										className="shrink-0 text-[11px] font-semibold text-accent cursor-pointer transition-opacity duration-150 hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
									>{restoringId === v._id ? 'Restoring…' : 'Restore'}</button>
								</div>
							))
						)}
					</div>
				)}

				<div className="flex gap-2.5 mt-1">
					<button
						onClick={onClose}
						className="bg-ink/8 border border-ink/20 text-ink rounded-[10px] font-semibold cursor-pointer transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-[0.98] flex-1 p-[11px] text-[13.5px]"
					>Close</button>
					<button
						onClick={() => onEdit(note)}
						className="btn-primary flex-1 p-[11px] text-[13.5px]"
					>Edit</button>
				</div>
			</div>
		</div>
	)
}

export default NoteViewModal
