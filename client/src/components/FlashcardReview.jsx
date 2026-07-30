import {useEffect, useState} from 'react'
import api from '../api/axios'
import {useToast} from '../context/ToastContext'

// Quality scores fed to the server's SM-2 implementation (0-5). Labels match
// the familiar Anki-style grading vocabulary rather than exposing raw
// numbers to the user.
const GRADES = [
	{quality: 1, label: 'Again', className: 'bg-danger/18 text-danger-light hover:bg-danger/28'},
	{quality: 3, label: 'Hard', className: 'bg-amber/18 text-amber hover:bg-amber/28'},
	{quality: 4, label: 'Good', className: 'bg-growth/18 text-growth hover:bg-growth/28'},
	{quality: 5, label: 'Easy', className: 'bg-accent/18 text-accent hover:bg-accent/28'},
]

// noteId present -> review that note's whole deck (used right after
// generating). noteId absent -> the global spaced-repetition queue (cards
// due today across every note), same GET /flashcards/due the Sidebar entry
// point uses.
function FlashcardReview({isOpen, noteId, onClose}) {
	const [cards, setCards] = useState([])
	const [index, setIndex] = useState(0)
	const [revealed, setRevealed] = useState(false)
	const [loading, setLoading] = useState(true)
	const [grading, setGrading] = useState(false)
	const toast = useToast()

	/* eslint-disable react-hooks/set-state-in-effect -- fetch driven by external isOpen/noteId prop change, not derived local state */
	useEffect(() => {
		if (!isOpen) return
		let ignore = false
		setLoading(true)
		setIndex(0)
		setRevealed(false)
		;(async () => {
			try {
				const url = noteId ? `/notes/${noteId}/flashcards` : '/flashcards/due'
				const response = await api.get(url)
				if (!ignore) setCards(response.data)
			} catch {
				if (!ignore) toast.error('Could not load flashcards.')
			} finally {
				if (!ignore) setLoading(false)
			}
		})()
		return () => { ignore = true }
		// eslint-disable-next-line react-hooks/exhaustive-deps -- toast is stable from context, omitting it avoids re-fetching on unrelated re-renders
	}, [isOpen, noteId])
	/* eslint-enable react-hooks/set-state-in-effect */

	if (!isOpen) return null

	const current = cards[index]

	const handleGrade = async (quality) => {
		if (!current || grading) return
		setGrading(true)
		try {
			await api.post(`/flashcards/${current._id}/review`, {quality})
		} catch {
			toast.error('Could not save that review, moving on anyway.')
		} finally {
			setGrading(false)
			setRevealed(false)
			setIndex((i) => i + 1)
		}
	}

	return (
		<div
			className="fixed inset-0 bg-[#0a0b10]/60 backdrop-blur-[3px] flex items-center justify-center z-30 p-4 min-[381px]:p-6"
			onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
		>
			<div className="w-full max-w-[440px] bg-[linear-gradient(160deg,var(--color-panel-a),var(--color-panel-b))] border border-accent/35 rounded-[20px] p-5 min-[381px]:p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)] flex flex-col gap-4">
				<div className="flex items-center justify-between">
					<h3 className="text-base font-bold">Flashcards</h3>
					<button
						onClick={onClose}
						aria-label="Close"
						className="w-7 h-7 p-0 rounded-[8px] bg-ink/6 border-none text-ink/62 text-xs font-semibold cursor-pointer transition-[opacity,transform] duration-200 hover:bg-ink/10 hover:opacity-100 active:scale-[0.98]"
					>✕</button>
				</div>

				{loading ? (
					<p className="text-[13px] text-ink/50 text-center py-8">Loading…</p>
				) : cards.length === 0 ? (
					<p className="text-[13px] text-ink/50 text-center py-8">No flashcards due right now. Nice work!</p>
				) : index >= cards.length ? (
					<div className="text-center py-8">
						<p className="text-[14px] text-ink/80 font-semibold mb-1">All done!</p>
						<p className="text-[12.5px] text-ink/50">Reviewed {cards.length} card{cards.length === 1 ? '' : 's'}.</p>
					</div>
				) : (
					<>
						<div className="text-[11px] text-ink/40">
							{index + 1} of {cards.length}{current.note?.title ? ` · ${current.note.title}` : ''}
						</div>
						<div
							onClick={() => setRevealed((r) => !r)}
							className="min-h-[140px] rounded-[14px] border border-ink/12 bg-ink/5 p-5 flex items-center justify-center text-center cursor-pointer"
						>
							<p className="text-[15px] text-ink/90 leading-relaxed">{revealed ? current.answer : current.question}</p>
						</div>
						{!revealed ? (
							<button onClick={() => setRevealed(true)} className="btn-primary p-[11px] text-[13.5px]">Show answer</button>
						) : (
							<div className="grid grid-cols-4 gap-2">
								{GRADES.map((g) => (
									<button
										key={g.quality}
										onClick={() => handleGrade(g.quality)}
										disabled={grading}
										className={`py-2.5 rounded-[10px] text-[12px] font-semibold cursor-pointer transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${g.className}`}
									>{g.label}</button>
								))}
							</div>
						)}
					</>
				)}
			</div>
		</div>
	)
}

export default FlashcardReview
