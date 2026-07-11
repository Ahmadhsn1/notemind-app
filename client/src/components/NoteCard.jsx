import {useState} from 'react'
import {folderColor} from '../utils/folderColor'
import {relativeTime} from '../utils/relativeTime'

function NoteCard({note, onDelete, onEdit, onSummarize, onView}) {
	const [loading, setLoading] = useState(false)

	const handleSummarize = async (e) => {
		e.stopPropagation()
		setLoading(true)
		try {
			await onSummarize(note._id)
		} catch {
			alert('Summarize failed. Try again.')
		} finally {
			setLoading(false)
		}
	}

	const iconBtnBase = 'w-[26px] h-[26px] p-0 rounded-[7px] flex items-center justify-center bg-[#0f0c29]/55 border border-white/15 text-white/62 text-sm font-semibold cursor-pointer transition-[opacity,transform] duration-200 hover:opacity-100 active:scale-[0.98]'

	return (
		<div
			onClick={() => onView(note)}
			className="bg-white/7 backdrop-blur-[14px] border border-white/13 rounded-[14px] p-4 flex flex-col gap-2.5 relative transition-[transform,border-color] duration-200 hover:-translate-y-[3px] hover:border-[#a29bfe]/40 cursor-pointer group"
		>
			<div className="flex items-start justify-between gap-2">
				<div className="flex items-center gap-2 min-w-0">
					<span className="w-2 h-2 rounded-full shrink-0" style={{background: folderColor(note.folder)}} />
					<h3 className="text-white text-[15px] font-semibold truncate">{note.title}</h3>
				</div>

				<div className="flex gap-1 shrink-0 opacity-100 transition-opacity duration-150 min-[761px]:opacity-0 min-[761px]:group-hover:opacity-100">
					<button className={`${iconBtnBase} hover:bg-[#a29bfe]/22 hover:text-[#a29bfe]`} onClick={handleSummarize} disabled={loading} aria-label="Summarize" title="Summarize with AI">
						<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className={loading ? 'animate-[spin_0.9s_linear_infinite]' : ''}><path d="M12 2l1.8 5.6L19 9.4l-5.2 1.9L12 17l-1.8-5.7L5 9.4l5.2-1.8L12 2Z" /></svg>
					</button>
					<button className={`${iconBtnBase} hover:bg-[#a29bfe]/22 hover:text-[#a29bfe]`} onClick={(e) => { e.stopPropagation(); onEdit(note) }} aria-label="Edit" title="Edit">
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
					</button>
					<button className={`${iconBtnBase} hover:bg-[#d63031]/22 hover:text-[#ff7675]`} onClick={(e) => { e.stopPropagation(); onDelete(note) }} aria-label="Delete" title="Delete">
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" /></svg>
					</button>
				</div>
			</div>
			<div className="text-[11px] text-white/42">{note.folder} · {relativeTime(note.createdAt)}</div>

			<p className="text-[13px] text-white/60 leading-[1.55] line-clamp-3">{note.body}</p>

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
		</div>
	)
}

export default NoteCard
