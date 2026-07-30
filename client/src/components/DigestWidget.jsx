import {useEffect, useState} from 'react'
import api from '../api/axios'

const SPARKLE_PATH = <path d="M12 2l1.8 5.6L19 9.4l-5.2 1.9L12 17l-1.8-5.7L5 9.4l5.2-1.8L12 2Z" />

// Fetched once per Dashboard mount — a recap over the last 7 days of note
// activity plus "on this day" resurfaced notes (see noteController.getDigest
// for both). Silent on failure and renders nothing while empty, since this
// is a nice-to-have landing-page widget, not core functionality.
function DigestWidget({onViewNote}) {
	const [digest, setDigest] = useState(null)
	const [onThisDay, setOnThisDay] = useState([])
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		let ignore = false
		;(async () => {
			try {
				const response = await api.get('/notes/digest')
				if (!ignore) {
					setDigest(response.data.digest)
					setOnThisDay(response.data.onThisDay || [])
				}
			} catch {
				// silent, see comment above
			} finally {
				if (!ignore) setLoading(false)
			}
		})()
		return () => { ignore = true }
	}, [])

	if (loading || (!digest && onThisDay.length === 0)) return null

	return (
		<div className="mb-5 flex flex-col gap-3">
			{digest && (
				<div className="bg-gradient-to-br from-accent/12 to-growth/10 border border-accent/25 rounded-[14px] p-4 flex gap-3 items-start">
					<div className="w-8 h-8 shrink-0 rounded-full bg-accent/20 flex items-center justify-center">
						<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="text-accent">{SPARKLE_PATH}</svg>
					</div>
					<div className="min-w-0">
						<div className="text-[11px] font-bold uppercase tracking-[0.05em] text-accent mb-1">Momo's Recap</div>
						<p className="text-[13px] text-ink/75 leading-[1.55]">{digest}</p>
					</div>
				</div>
			)}

			{onThisDay.length > 0 && (
				<div className="bg-ink/5 border border-ink/12 rounded-[14px] p-4">
					<div className="text-[11px] font-bold uppercase tracking-[0.05em] text-ink/40 mb-2">On this day</div>
					<div className="flex flex-wrap gap-1.5">
						{onThisDay.map((n) => (
							<button
								key={n._id}
								onClick={() => onViewNote(n)}
								className="py-1.5 px-3 rounded-full text-[12px] font-medium bg-ink/8 text-ink/70 cursor-pointer transition-colors duration-150 hover:bg-ink/14 hover:text-ink"
							>{n.title}</button>
						))}
					</div>
				</div>
			)}
		</div>
	)
}

export default DigestWidget
