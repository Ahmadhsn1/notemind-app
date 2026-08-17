import {memo, useState} from 'react'
import {folderColor} from '../utils/folderColor'
import {relativeTime} from '../utils/relativeTime'
import {useToast} from '../context/ToastContext'

const SPARKLE_PATH = <path d="M12 2l1.8 5.6L19 9.4l-5.2 1.9L12 17l-1.8-5.7L5 9.4l5.2-1.8L12 2Z" />
const PIN_PATH = <><path d="M9 4h6l-.6 5.2L18 13v2H6v-2l3.6-3.8L9 4Z" /><path d="M12 15v5" /></>
const ARCHIVE_PATH = <><path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2H3V7Z" /><path d="M4 9h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9Z" /><path d="M10 13h4" /></>
const UNARCHIVE_PATH = <><path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2H3V7Z" /><path d="M4 9h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9Z" /><path d="M12 16v-4M10 13.5 12 11.5 14 13.5" /></>
const RESTORE_PATH = <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></>
const TRASH_PATH = <><path d="M3 6h18" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" /></>
const EDIT_PATH = <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>
const BELL_PATH = <><path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" /><path d="M10 20a2 2 0 0 0 4 0" /></>

const formatReminder = (dateString) => new Date(dateString).toLocaleString(undefined, {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'})

// Memoized because Dashboard renders potentially hundreds of these, and its
// own re-renders (e.g. every keystroke in the note editor) don't change any
// individual note's data. This only pays off because Dashboard.jsx also
// wraps every handler prop passed in with useCallback — React.memo's shallow
// prop comparison would otherwise see a fresh function on every render and
// re-render anyway, making the memo a no-op.
function NoteCard({note, view, onDelete, onEdit, onSummarize, onView, onTogglePin, onArchive, onUnarchive, onRestore, onPermanentDelete, onSelectTag, matchedBySemanticSearch}) {
	const [loading, setLoading] = useState(false)
	const toast = useToast()

	const handleSummarize = async (e) => {
		e.stopPropagation()
		setLoading(true)
		try {
			await onSummarize(note._id)
		} catch {
			toast.error('Summarize failed. Try again.')
		} finally {
			setLoading(false)
		}
	}

	const stop = (fn) => (e) => { e.stopPropagation(); fn(note) }
	// Same stopPropagation need as `stop` above, but a tag click hands the
	// clicked tag's name to onSelectTag, not the note — the whole card is a
	// click target (onView below), so without stopping propagation a tag
	// click would also open the note.
	const stopTag = (tag) => (e) => { e.stopPropagation(); onSelectTag(tag) }

	const iconBtnBase = 'w-[26px] h-[26px] p-0 rounded-[7px] flex items-center justify-center bg-ink-deep/55 border border-ink/15 text-ink/62 text-sm font-semibold cursor-pointer transition-[opacity,transform] duration-200 hover:opacity-100 active:scale-[0.98]'

	return (
		<div
			onClick={() => onView(note)}
			className="bg-ink/7 backdrop-blur-[14px] border border-ink/13 rounded-[14px] p-4 flex flex-col gap-2.5 relative transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-[3px] hover:border-accent/40 hover:shadow-[0_18px_36px_-18px_rgba(91,120,255,0.35)] cursor-pointer group"
		>
			<div className="flex items-start justify-between gap-2">
				<div className="flex items-center gap-2 min-w-0">
					<span className="w-2 h-2 rounded-full shrink-0" style={{background: folderColor(note.folder)}} />
					<h3 className="text-ink text-[15px] font-semibold truncate">{note.title}</h3>
					{matchedBySemanticSearch && (
						<span
							title="Matched by meaning, not exact keywords"
							className="shrink-0 flex items-center gap-1 py-[2px] px-[7px] rounded-full text-[10px] font-semibold bg-accent/16 text-accent"
						>
							<svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">{SPARKLE_PATH}</svg>
							related
						</span>
					)}
				</div>

				<div className="flex gap-1 shrink-0 opacity-100 transition-opacity duration-150 min-[761px]:opacity-0 min-[761px]:group-hover:opacity-100">
					{view === 'trash' ? (
						<>
							<button className={`${iconBtnBase} hover:bg-accent/22 hover:text-accent`} onClick={stop(onRestore)} aria-label="Restore" title="Restore">
								<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{RESTORE_PATH}</svg>
							</button>
							<button className={`${iconBtnBase} hover:bg-danger/22 hover:text-danger-light`} onClick={stop(onPermanentDelete)} aria-label="Delete forever" title="Delete forever">
								<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{TRASH_PATH}</svg>
							</button>
						</>
					) : (
						<>
							{view === 'active' && (
								<button
									className={`${iconBtnBase} ${note.pinned ? 'bg-accent/22 border-accent/40 text-accent' : 'hover:bg-accent/22 hover:text-accent'}`}
									onClick={stop(onTogglePin)}
									aria-label={note.pinned ? 'Unpin' : 'Pin'}
									title={note.pinned ? 'Unpin' : 'Pin'}
								>
									<svg width="13" height="13" viewBox="0 0 24 24" fill={note.pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{PIN_PATH}</svg>
								</button>
							)}
							<button className={`${iconBtnBase} hover:bg-accent/22 hover:text-accent`} onClick={handleSummarize} disabled={loading} aria-label="Summarize" title="Summarize with AI">
								<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className={loading ? 'animate-[spin_0.9s_linear_infinite]' : ''}>{SPARKLE_PATH}</svg>
							</button>
							<button className={`${iconBtnBase} hover:bg-accent/22 hover:text-accent`} onClick={stop(onEdit)} aria-label="Edit" title="Edit">
								<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{EDIT_PATH}</svg>
							</button>
							{view === 'archived' ? (
								<button className={`${iconBtnBase} hover:bg-accent/22 hover:text-accent`} onClick={stop(onUnarchive)} aria-label="Unarchive" title="Move back to notes">
									<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{UNARCHIVE_PATH}</svg>
								</button>
							) : (
								<button className={`${iconBtnBase} hover:bg-accent/22 hover:text-accent`} onClick={stop(onArchive)} aria-label="Archive" title="Archive">
									<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{ARCHIVE_PATH}</svg>
								</button>
							)}
							<button className={`${iconBtnBase} hover:bg-danger/22 hover:text-danger-light`} onClick={stop(onDelete)} aria-label="Delete" title="Move to trash">
								<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{TRASH_PATH}</svg>
							</button>
						</>
					)}
				</div>
			</div>
			<div className="text-[11px] text-ink/42">{note.folder} · {relativeTime(note.createdAt)}</div>

			{note.reminderAt && (
				<div className={`inline-flex items-center gap-1 self-start py-[3px] px-2 rounded-full text-[10.5px] font-semibold ${
					new Date(note.reminderAt) < new Date() ? 'bg-danger/20 text-danger-light' : 'bg-accent/16 text-accent'
				}`}>
					<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{BELL_PATH}</svg>
					{new Date(note.reminderAt) < new Date() ? 'Overdue' : 'Due'} {formatReminder(note.reminderAt)}
				</div>
			)}

			<p className="text-[13px] text-ink/60 leading-[1.55] line-clamp-3">{note.body}</p>

			{note.tags.length > 0 && (
				<div className="flex flex-wrap gap-1.5">
					{note.tags.map((t) => (
						<button
							key={t}
							type="button"
							onClick={stopTag(t)}
							className="bg-accent/30 text-accent text-[11px] py-[3px] px-2.5 rounded-full cursor-pointer transition-colors duration-150 hover:bg-accent/45"
						>{t}</button>
					))}
				</div>
			)}

			{note.aiSummary && (
				<div className="bg-gradient-to-br from-accent/12 to-growth/10 border border-accent/25 rounded-[10px] py-2.5 px-3 flex flex-col gap-1.5">
					<div className="flex items-center gap-[5px] text-[10.5px] font-bold tracking-[0.04em] text-accent uppercase">
						<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">{SPARKLE_PATH}</svg>
						AI summary
					</div>
					<p className="text-[12.5px] text-ink/60 leading-[1.5]">{note.aiSummary}</p>
				</div>
			)}
		</div>
	)
}

export default memo(NoteCard)
