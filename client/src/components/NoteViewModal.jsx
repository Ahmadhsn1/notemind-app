import {useEffect} from 'react'
import {folderColor} from '../utils/folderColor'
import {relativeTime} from '../utils/relativeTime'

function NoteViewModal({isOpen, note, onClose, onEdit, onPrev, onNext, currentIndex, totalCount}) {
	useEffect(() => {
		if (!isOpen) return

		const handleKeyDown = (e) => {
			if (e.key === 'ArrowLeft') onPrev()
			else if (e.key === 'ArrowRight') onNext()
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [isOpen, onPrev, onNext])

	if (!isOpen || !note) return null

	const hasMultiple = totalCount > 1
	// Fixed side buttons only fit without overlapping the card on wide viewports —
	// the card spans nearly the full screen width below the 761px breakpoint used
	// elsewhere in this app, so mobile gets an inline prev/next row instead (below).
	const navBtnBase = 'hidden min-[761px]:flex fixed top-1/2 -translate-y-1/2 w-10 h-10 p-0 rounded-full items-center justify-center bg-[#0f0c29]/55 border border-white/15 text-white/62 cursor-pointer transition-[opacity,transform] duration-200 hover:bg-[#a29bfe]/22 hover:text-[#a29bfe] active:scale-[0.98] z-20'
	const inlineNavBtnBase = 'w-7 h-7 p-0 shrink-0 rounded-[8px] flex items-center justify-center bg-[#0f0c29]/55 border border-white/15 text-white/62 cursor-pointer transition-[opacity,transform] duration-200 hover:bg-[#a29bfe]/22 hover:text-[#a29bfe] active:scale-[0.98]'

	return (
		<div
			className="fixed inset-0 bg-[#0a081c]/60 backdrop-blur-[3px] flex items-center justify-center z-20 p-4 min-[381px]:p-6"
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

			<div className="w-full max-w-[480px] bg-[linear-gradient(160deg,rgba(36,30,74,0.97),rgba(26,20,67,0.99))] border border-[#a29bfe]/35 rounded-[20px] p-4 min-[381px]:p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)] flex flex-col gap-3">
				<div className="flex items-start justify-between gap-2">
					<div className="flex items-center gap-2 min-w-0">
						<span className="w-2 h-2 rounded-full shrink-0" style={{background: folderColor(note.folder)}} />
						<h3 className="text-white text-base font-bold break-words">{note.title}</h3>
					</div>
					<button
						onClick={onClose}
						aria-label="Close"
						className="w-7 h-7 p-0 shrink-0 rounded-[8px] bg-white/6 border-none text-white/62 text-xs font-semibold cursor-pointer transition-[opacity,transform] duration-200 hover:bg-white/10 hover:opacity-100 active:scale-[0.98]"
					>✕</button>
				</div>

				<div className="text-[11px] text-white/42">{note.folder} · {relativeTime(note.createdAt)}</div>

				{hasMultiple && (
					<div className="hidden min-[761px]:flex text-[11px] text-white/42 items-center gap-1.5 -mt-1.5">
						<span>{currentIndex + 1} of {totalCount}</span>
						<span className="text-white/25">·</span>
						<span>use ← → to browse other notes</span>
					</div>
				)}

				{hasMultiple && (
					<div className="flex min-[761px]:hidden items-center justify-between -mt-1.5">
						<button onClick={onPrev} aria-label="Previous note" className={inlineNavBtnBase}>
							<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
						</button>
						<span className="text-[11px] text-white/42">{currentIndex + 1} of {totalCount}</span>
						<button onClick={onNext} aria-label="Next note" className={inlineNavBtnBase}>
							<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
						</button>
					</div>
				)}

				<p className="text-[13.5px] text-white/70 leading-[1.6] whitespace-pre-wrap max-h-[50vh] overflow-y-auto">{note.body}</p>

				{note.tags.length > 0 && (
					<div className="flex flex-wrap gap-1.5">
						{note.tags.map((t) => <span key={t} className="bg-[#6c5ce7]/30 text-[#a29bfe] text-[11px] py-[3px] px-2.5 rounded-full">{t}</span>)}
					</div>
				)}

				{note.aiSummary && (
					<div className="bg-gradient-to-br from-[#a29bfe]/12 to-[#e84393]/10 border border-[#a29bfe]/25 rounded-[10px] py-2.5 px-3 flex flex-col gap-1.5">
						<div className="flex items-center gap-[5px] text-[10.5px] font-bold tracking-[0.04em] text-[#a29bfe] uppercase">
							<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.8 5.6L19 9.4l-5.2 1.9L12 17l-1.8-5.7L5 9.4l5.2-1.8L12 2Z" /></svg>
							AI summary
						</div>
						<p className="text-[12.5px] text-white/60 leading-[1.5]">{note.aiSummary}</p>
					</div>
				)}

				<div className="flex gap-2.5 mt-1">
					<button
						onClick={onClose}
						className="bg-white/8 border border-white/20 text-white rounded-[10px] font-semibold cursor-pointer transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-[0.98] flex-1 p-[11px] text-[13.5px]"
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
