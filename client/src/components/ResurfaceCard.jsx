import {useEffect, useLayoutEffect, useRef, useState} from 'react'
import {createPortal} from 'react-dom'
import {computePosition, offset, flip, shift} from '@floating-ui/dom'
import api from '../api/axios'

// Inline 14-day grid popover for the reflection streak — same
// computePosition/offset/flip/shift pattern as StreakInfoPopover.jsx, kept
// as a sub-component in this file rather than a separate one since this is
// meant to be the feature's single new frontend file.
function StreakPopover({anchorRef, streak, longestStreak, days, onClose}) {
	const popRef = useRef(null)

	useLayoutEffect(() => {
		if (!anchorRef.current || !popRef.current) return
		computePosition(anchorRef.current, popRef.current, {
			strategy: 'fixed',
			placement: 'bottom-end',
			middleware: [offset(10), flip(), shift({padding: 8})],
		}).then(({x, y}) => {
			if (popRef.current) Object.assign(popRef.current.style, {left: `${x}px`, top: `${y}px`})
		})
	})

	useEffect(() => {
		const handleClick = (e) => {
			if (popRef.current && !popRef.current.contains(e.target) && !anchorRef.current?.contains(e.target)) onClose()
		}
		document.addEventListener('mousedown', handleClick)
		return () => document.removeEventListener('mousedown', handleClick)
	}, [anchorRef, onClose])

	const todayStr = (() => {
		const d = new Date()
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
	})()

	return createPortal(
		<div
			ref={popRef}
			className="fixed z-[60] w-[248px] bg-[linear-gradient(160deg,var(--color-panel-a),var(--color-panel-b))] border border-accent/35 rounded-[14px] p-3.5 shadow-[0_16px_40px_rgba(0,0,0,0.4)]"
		>
			<div className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-accent mb-2">Reflection streak</div>
			<div className="text-[13px] text-ink/80 mb-3">
				<span className="font-bold">{streak}</span> day{streak === 1 ? '' : 's'} in a row
				{longestStreak > streak && <span className="text-ink/50"> · best {longestStreak}</span>}
			</div>
			<div className="grid grid-cols-7 gap-1.5">
				{days.map((d) => (
					<div
						key={d.date}
						title={`${new Date(`${d.date}T00:00:00`).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}${d.active ? ' — reflected' : ''}`}
						className={`w-5 h-5 rounded-[5px] ${d.active ? 'bg-growth' : 'bg-ink/10'} ${d.date === todayStr ? 'ring-2 ring-accent ring-offset-1 ring-offset-ink-deep' : ''}`}
					/>
				))}
			</div>
			<div className="text-[10px] text-ink/35 mt-2">Last 14 days</div>
		</div>,
		document.body
	)
}

// A daily-proactive counterpart to DigestWidget's on-demand "on this day"
// section — fully separate feature/streak/model, see server/services/
// resurfaceService.js. Self-contained fetch, no props besides onViewNote,
// same shape as DigestWidget.jsx.
function ResurfaceCard({onViewNote}) {
	const [data, setData] = useState(null)
	const [streakData, setStreakData] = useState(null)
	const [loading, setLoading] = useState(true)
	const [expanded, setExpanded] = useState(false)
	const [reply, setReply] = useState('')
	const [submitting, setSubmitting] = useState(false)
	const [showStreakPopover, setShowStreakPopover] = useState(false)
	const [daysAgo, setDaysAgo] = useState(0)
	const streakBadgeRef = useRef(null)

	useEffect(() => {
		let ignore = false
		;(async () => {
			try {
				const [todayRes, streakRes] = await Promise.all([
					api.get('/resurface/today'),
					api.get('/resurface/streak'),
				])
				if (!ignore) {
					setData(todayRes.data)
					setStreakData(streakRes.data)
					setReply(todayRes.data.engagementReply || '')
					if (todayRes.data.oldNote) {
						setDaysAgo(Math.round((Date.now() - new Date(todayRes.data.oldNote.createdAt).getTime()) / (24 * 60 * 60 * 1000)))
					}
				}
			} catch {
				// Silent — this is a nice-to-have Dashboard widget, not core
				// functionality, same convention as DigestWidget/MomentumHero.
			} finally {
				if (!ignore) setLoading(false)
			}
		})()
		return () => { ignore = true }
	}, [])

	const handleExpand = () => {
		if (expanded) return
		setExpanded(true)
		api.patch('/resurface/today/viewed').catch(() => {
			// Fire-and-forget soft signal — not worth surfacing a failure for.
		})
	}

	const handleSubmitReply = async () => {
		if (submitting) return
		setSubmitting(true)
		try {
			const res = await api.post('/resurface/today/reply', {reply})
			setData((prev) => ({...prev, engagedAt: res.data.engagedAt, engagementReply: res.data.engagementReply}))
			const streakRes = await api.get('/resurface/streak')
			setStreakData(streakRes.data)
		} catch {
			// Silent, same nice-to-have convention as the rest of this widget.
		} finally {
			setSubmitting(false)
		}
	}

	if (loading || !data || data.method === 'none' || !data.oldNote) return null

	const {oldNote, reflection, engagedAt} = data

	return (
		<div className="mb-5 bg-ink/5 border border-ink/12 rounded-[14px] p-4 flex flex-col gap-3">
			<button
				type="button"
				onClick={handleExpand}
				className="w-full flex items-start justify-between gap-3 text-left cursor-pointer"
			>
				<div className="flex gap-3 items-start min-w-0">
					<div className="w-8 h-8 shrink-0 rounded-full bg-accent/20 flex items-center justify-center">
						<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
					</div>
					<div className="min-w-0">
						<div className="text-[11px] font-bold uppercase tracking-[0.05em] text-accent mb-1">Momo remembers…</div>
						<p className="text-[13px] font-semibold text-ink/85 truncate">{oldNote.title}</p>
						<p className="text-[11px] text-ink/40">{oldNote.folder} · {daysAgo} day{daysAgo === 1 ? '' : 's'} ago</p>
					</div>
				</div>

				{streakData && streakData.streak > 0 && (
					<span
						ref={streakBadgeRef}
						role="button"
						tabIndex={0}
						onClick={(e) => { e.stopPropagation(); setShowStreakPopover((v) => !v) }}
						onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setShowStreakPopover((v) => !v) } }}
						className="shrink-0 py-1 px-2.5 rounded-full text-[11px] font-semibold bg-growth/15 text-growth cursor-pointer whitespace-nowrap"
					>{streakData.streak}-day streak</span>
				)}
			</button>

			{expanded && (
				<div className="flex flex-col gap-3 pt-1 border-t border-ink/10">
					{reflection && (
						<p className="text-[13px] text-ink/75 leading-[1.55]">{reflection}</p>
					)}
					<p className="text-[12.5px] text-ink/55 leading-[1.5] line-clamp-3">{oldNote.body}</p>
					<button
						type="button"
						onClick={() => onViewNote(oldNote)}
						className="self-start text-[11.5px] font-semibold text-accent cursor-pointer transition-opacity duration-150 hover:opacity-80"
					>Open note</button>

					{engagedAt ? (
						<div className="flex flex-col gap-1.5">
							<div className="text-[11.5px] font-semibold text-growth">You reflected on this today ✓</div>
							{data.engagementReply && (
								<p className="text-[12.5px] text-ink/60 italic">"{data.engagementReply}"</p>
							)}
						</div>
					) : (
						<div className="flex flex-col gap-2">
							<textarea
								value={reply}
								onChange={(e) => setReply(e.target.value)}
								placeholder="Still true? Has your thinking changed? (optional)"
								maxLength={280}
								rows={2}
								className="input-base w-full resize-none text-[12.5px]"
							/>
							<button
								type="button"
								onClick={handleSubmitReply}
								disabled={submitting}
								className="self-start py-1.5 px-3.5 rounded-[8px] text-[12px] font-semibold bg-accent/20 text-accent cursor-pointer transition-colors hover:bg-accent/28 disabled:opacity-50 disabled:cursor-not-allowed"
							>{submitting ? 'Saving…' : reply.trim() ? 'Reflect' : 'Mark as reflected'}</button>
						</div>
					)}
				</div>
			)}

			{showStreakPopover && streakData && (
				<StreakPopover
					anchorRef={streakBadgeRef}
					streak={streakData.streak}
					longestStreak={streakData.longestStreak}
					days={streakData.days}
					onClose={() => setShowStreakPopover(false)}
				/>
			)}
		</div>
	)
}

export default ResurfaceCard
