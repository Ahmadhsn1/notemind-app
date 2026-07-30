import {useEffect, useMemo, useRef, useState} from 'react'
import api from '../api/axios'
import {toLocalDateKey} from '../utils/dateKey'
import StreakInfoPopover from './StreakInfoPopover'
import ActivityCalendarGrid from './ActivityCalendarGrid'

// Animates 0 -> target once, respecting reduced-motion. Used for the ring
// fill and its center number so the "success" moment (queue cleared) reads
// as something that just happened, not a static label.
function useCountUp(target, durationMs = 1100) {
	const [value, setValue] = useState(0)

	useEffect(() => {
		const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
		let raf
		if (reduce) {
			raf = requestAnimationFrame(() => setValue(target))
			return () => cancelAnimationFrame(raf)
		}

		const start = performance.now()
		const step = (now) => {
			const p = Math.min(1, (now - start) / durationMs)
			const eased = 1 - Math.pow(1 - p, 3)
			setValue(eased * target)
			if (p < 1) raf = requestAnimationFrame(step)
		}
		raf = requestAnimationFrame(step)
		return () => cancelAnimationFrame(raf)
	}, [target, durationMs])

	return value
}

const RADIUS = 40
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

// Ties the headline to the same real signals the ring/stat-line below
// already use, instead of a single fixed phrase every user saw every day
// regardless of activity. Deterministic by real state (not randomized) —
// same "no invented progress" principle as the rest of this component, just
// applied to the headline too. Order matters: first matching tier wins.
function getHeadline({notesThisWeek, pinnedCount, streak}) {
	if (streak >= 3) {
		return {lead: "You're on a", highlight: `${streak}-day streak.`}
	}
	if (notesThisWeek === 0) {
		return {lead: 'A blank page,', highlight: 'waiting for you.'}
	}
	if (notesThisWeek >= 5) {
		return {lead: "You've been on", highlight: 'a roll this week.'}
	}
	if (pinnedCount > 0) {
		return {lead: 'Your best ideas,', highlight: 'pinned and ready.'}
	}
	return {lead: 'Your thinking,', highlight: 'gathering momentum.'}
}

// A real "this week" snapshot built entirely from data Dashboard already
// has (note timestamps/pinned state) plus GET /notes/streak (a consecutive-
// day streak of note activity — created or edited — see
// noteController.getNoteStreak) and GET /flashcards/due (for the "cards
// waiting for review" line below, unrelated to the streak itself). No
// invented targets or fabricated stats — the ring's fill and center number
// are both directly the real streak, never a flat "100%"/binary flag.
function MomentumHero({notes, selectedDay, onSelectDay}) {
	const [dueCount, setDueCount] = useState(null)
	const [streak, setStreak] = useState(null)
	const [longestStreak, setLongestStreak] = useState(0)
	const [streakDays, setStreakDays] = useState([])
	const [showStreakInfo, setShowStreakInfo] = useState(false)
	const ringRef = useRef(null)
	// Captured once via useState's lazy initializer (the sanctioned place for
	// an impure Date.now() read) rather than called inline during render.
	const [now] = useState(() => Date.now())

	// "Daily activity" card's own view switcher — independent of the
	// headline/stat-line above, which always talks about the trailing week
	// regardless of which activity view is currently displayed. 'week' stays
	// computed client-side from the already-loaded `notes` prop (safe for a
	// single week); 'month'/'custom' fetch GET /notes/activity since they can
	// reach further back than the 200-note list Dashboard keeps in memory.
	const [activityView, setActivityView] = useState('week')
	const [monthCursor, setMonthCursor] = useState(() => {
		const d = new Date()
		return new Date(d.getFullYear(), d.getMonth(), 1)
	})
	const [customFrom, setCustomFrom] = useState(() => toLocalDateKey(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000)))
	const [customTo, setCustomTo] = useState(() => toLocalDateKey(new Date()))
	const [rangeDays, setRangeDays] = useState(null)
	const [rangeLoading, setRangeLoading] = useState(false)
	// Hover/focus (not click) state for the "Daily activity" chart — shown as
	// a fixed inline line in the card itself, not a floating popup, per the
	// "no separate popup box" requirement. Shared across all three views
	// (week/month/custom) since only one renders at a time.
	const [hoveredDay, setHoveredDay] = useState(null)

	useEffect(() => {
		if (activityView === 'week') return

		let from, to
		if (activityView === 'month') {
			from = toLocalDateKey(new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1))
			to = toLocalDateKey(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0))
		} else {
			if (!customFrom || !customTo || customFrom > customTo) return
			from = customFrom
			to = customTo
		}

		let ignore = false
		;(async () => {
			setRangeLoading(true)
			try {
				const res = await api.get('/notes/activity', {params: {from, to}})
				if (!ignore) setRangeDays(res.data.days)
			} catch {
				if (!ignore) setRangeDays(null)
			} finally {
				if (!ignore) setRangeLoading(false)
			}
		})()
		return () => { ignore = true }
	}, [activityView, monthCursor, customFrom, customTo])

	useEffect(() => {
		let ignore = false
		;(async () => {
			try {
				const [dueRes, streakRes] = await Promise.all([
					api.get('/flashcards/due'),
					api.get('/notes/streak'),
				])
				if (!ignore) {
					setDueCount(dueRes.data.length)
					setStreak(streakRes.data.streak)
					setLongestStreak(streakRes.data.longestStreak)
					setStreakDays(streakRes.data.days)
				}
			} catch {
				if (!ignore) {
					setDueCount(0)
					setStreak(0)
				}
			}
		})()
		return () => { ignore = true }
	}, [])

	// Click/tap toggles (needed for touch, where hover doesn't exist);
	// hover is handled separately via onMouseEnter/onMouseLeave on the ring.
	// Closes on outside click and Escape, matching common popover
	// conventions elsewhere in the app (e.g. CommandPalette's own-modal
	// awareness).
	useEffect(() => {
		if (!showStreakInfo) return
		const handleOutside = (e) => {
			if (!ringRef.current?.contains(e.target)) setShowStreakInfo(false)
		}
		const handleKey = (e) => {
			if (e.key === 'Escape') setShowStreakInfo(false)
		}
		document.addEventListener('mousedown', handleOutside)
		document.addEventListener('keydown', handleKey)
		return () => {
			document.removeEventListener('mousedown', handleOutside)
			document.removeEventListener('keydown', handleKey)
		}
	}, [showStreakInfo])

	const {notesThisWeek, pinnedCount, dailyCounts, dayLabels, dayKeys} = useMemo(() => {
		const DAY = 24 * 60 * 60 * 1000
		const buckets = new Array(7).fill(0)
		const labels = new Array(7).fill('')
		const keys = new Array(7).fill('')
		let weekCount = 0

		for (let i = 0; i < 7; i++) {
			const d = new Date(now - (6 - i) * DAY)
			labels[i] = d.toLocaleDateString(undefined, {weekday: 'narrow'})
			keys[i] = toLocalDateKey(d)
		}

		for (const n of notes) {
			const age = now - new Date(n.createdAt).getTime()
			if (age >= 0 && age < 7 * DAY) {
				weekCount++
				const dayIndex = 6 - Math.floor(age / DAY)
				buckets[Math.max(0, Math.min(6, dayIndex))]++
			}
		}

		return {
			notesThisWeek: weekCount,
			pinnedCount: notes.filter((n) => n.pinned).length,
			dailyCounts: buckets,
			dayLabels: labels,
			dayKeys: keys,
		}
	}, [notes, now])

	const allCaughtUp = dueCount === 0
	// Fills over a week of consecutive activity rather than a binary
	// caught-up/not-caught-up flag — ties the ring's fill directly to the
	// streak it displays, instead of an unrelated flashcard-due state.
	const ringTargetPercent = streak === null ? 0 : Math.min(100, (streak / 7) * 100)
	const animatedPercent = useCountUp(ringTargetPercent, 1200)
	const offset = CIRCUMFERENCE - (animatedPercent / 100) * CIRCUMFERENCE
	const maxDailyCount = Math.max(1, ...dailyCounts)
	const {lead, highlight} = getHeadline({notesThisWeek, pinnedCount, streak})

	return (
		<section className="grid grid-cols-1 min-[820px]:grid-cols-[1fr_auto] items-center gap-7 mb-7">
			<div>
				<div className="text-[11px] font-bold uppercase tracking-[0.1em] text-growth mb-2.5">This week</div>
				<h1 className="text-[26px] min-[560px]:text-[32px] font-extrabold tracking-[-0.03em] leading-[1.08] mb-3 text-balance">
					{lead} <span className="bg-gradient-to-r from-accent to-growth bg-clip-text text-transparent">{highlight}</span>
				</h1>
				<p className="text-[14.5px] text-ink/60 leading-[1.55] max-w-[48ch]">
					{notesThisWeek} note{notesThisWeek === 1 ? '' : 's'} written this week{pinnedCount > 0 ? `, ${pinnedCount} pinned` : ''}
					{dueCount === null ? '.' : allCaughtUp ? " — and today's review deck is fully cleared." : ` — and ${dueCount} flashcard${dueCount === 1 ? '' : 's'} waiting for review.`}
				</p>
				<div className="rounded-[12px] border border-ink/10 bg-ink/4 p-3 mt-4 max-w-[260px]">
					<div className="flex items-center justify-between mb-1.5">
						<div className="text-[10px] font-bold uppercase tracking-[0.06em] text-ink/35">Daily activity</div>
						<div className="flex items-center gap-0.5 bg-ink/6 rounded-[7px] p-0.5">
							{[['week', '7d'], ['month', 'Month'], ['custom', 'Custom']].map(([key, label]) => (
								<button
									key={key}
									type="button"
									onClick={() => setActivityView(key)}
									aria-pressed={activityView === key}
									className={`px-1.5 py-0.5 rounded-[5px] text-[9.5px] font-semibold cursor-pointer transition-colors ${
										activityView === key ? 'bg-accent/25 text-accent' : 'text-ink/45 hover:text-ink/70'
									}`}
								>{label}</button>
							))}
						</div>
					</div>

					{/* Fixed height so hovering/unhovering a bar or cell never shifts
					the layout below it — filled from hoveredDay, blank otherwise. */}
					<div className="h-[15px] text-[10.5px] font-semibold text-ink/55 mb-1">
						{hoveredDay && `${new Date(`${hoveredDay.date}T00:00:00`).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})} — ${hoveredDay.count} note${hoveredDay.count === 1 ? '' : 's'}`}
					</div>

					{activityView === 'week' && (
						<>
							<div className="flex items-end gap-1.5 h-10">
								{dailyCounts.map((c, i) => {
									const isSelected = dayKeys[i] === selectedDay
									const label = dayLabels[i]
									const hover = () => setHoveredDay({date: dayKeys[i], count: c})
									const unhover = () => setHoveredDay(null)
									return (
										<button
											key={i}
											type="button"
											onClick={() => onSelectDay?.(dayKeys[i])}
											onMouseEnter={hover}
											onMouseLeave={unhover}
											onFocus={hover}
											onBlur={unhover}
											title={`${c} note${c === 1 ? '' : 's'}`}
											aria-pressed={isSelected}
											aria-label={`${label}: ${c} note${c === 1 ? '' : 's'}${isSelected ? ' (selected)' : ''}`}
											className="flex-1 h-full flex items-end cursor-pointer rounded-[4px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
										>
											<div
												className={`w-full rounded-t-[4px] transition-[height,background-color,filter] duration-300 hover:brightness-90 ${isSelected ? 'bg-accent' : 'bg-growth'}`}
												style={{height: `${Math.max(c > 0 ? 14 : 6, (c / maxDailyCount) * 100)}%`, opacity: c > 0 || isSelected ? 1 : 0.3}}
											/>
										</button>
									)
								})}
							</div>
							<div className="flex gap-1.5 mt-1.5">
								{dayLabels.map((d, i) => (
									<div key={i} className={`flex-1 text-center text-[9.5px] font-semibold ${dayKeys[i] === selectedDay ? 'text-accent' : 'text-ink/35'}`}>{d}</div>
								))}
							</div>
						</>
					)}

					{activityView === 'month' && (
						<div>
							<div className="flex items-center justify-between mb-2">
								<button
									type="button"
									onClick={() => setMonthCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
									aria-label="Previous month"
									className="w-5 h-5 flex items-center justify-center rounded-[5px] text-ink/50 hover:text-ink hover:bg-ink/10 cursor-pointer"
								>‹</button>
								<span className="text-[10.5px] font-semibold text-ink/60">
									{monthCursor.toLocaleDateString(undefined, {month: 'long', year: 'numeric'})}
								</span>
								<button
									type="button"
									onClick={() => setMonthCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
									aria-label="Next month"
									className="w-5 h-5 flex items-center justify-center rounded-[5px] text-ink/50 hover:text-ink hover:bg-ink/10 cursor-pointer"
								>›</button>
							</div>
							{rangeLoading || !rangeDays ? (
								<div className="h-20 flex items-center justify-center text-[11px] text-ink/35">Loading…</div>
							) : (
								<ActivityCalendarGrid mode="month" days={rangeDays} selectedDay={selectedDay} onSelectDay={onSelectDay} onHoverDay={setHoveredDay} />
							)}
						</div>
					)}

					{activityView === 'custom' && (
						<div>
							<div className="flex items-center gap-1.5 mb-2">
								<input
									type="date"
									value={customFrom}
									onChange={(e) => setCustomFrom(e.target.value)}
									max={customTo}
									className="flex-1 min-w-0 bg-ink/6 border border-ink/12 rounded-[6px] px-1.5 py-1 text-[10.5px] text-ink/70"
								/>
								<span className="text-ink/30 text-[10px]">–</span>
								<input
									type="date"
									value={customTo}
									onChange={(e) => setCustomTo(e.target.value)}
									min={customFrom}
									max={toLocalDateKey(new Date())}
									className="flex-1 min-w-0 bg-ink/6 border border-ink/12 rounded-[6px] px-1.5 py-1 text-[10.5px] text-ink/70"
								/>
							</div>
							{!customFrom || !customTo || customFrom > customTo ? (
								<div className="text-[11px] text-danger-light">Pick a valid date range.</div>
							) : rangeLoading || !rangeDays ? (
								<div className="h-20 flex items-center justify-center text-[11px] text-ink/35">Loading…</div>
							) : (
								<ActivityCalendarGrid mode="custom" days={rangeDays} selectedDay={selectedDay} onSelectDay={onSelectDay} onHoverDay={setHoveredDay} />
							)}
						</div>
					)}
				</div>
			</div>

			<div
				ref={ringRef}
				className={`relative w-[148px] h-[148px] mx-auto min-[820px]:mx-0 shrink-0 ${streak !== null ? 'cursor-pointer' : ''}`}
				onMouseEnter={() => streak !== null && setShowStreakInfo(true)}
				onMouseLeave={() => setShowStreakInfo(false)}
				onClick={() => streak !== null && setShowStreakInfo((v) => !v)}
			>
				<svg viewBox="0 0 96 96" className="w-full h-full -rotate-90">
					<circle cx="48" cy="48" r={RADIUS} fill="none" stroke="color-mix(in srgb, var(--color-ink) 8%, transparent)" strokeWidth="8" />
					<circle
						cx="48" cy="48" r={RADIUS} fill="none" stroke="url(#momentumRingGrad)" strokeWidth="8" strokeLinecap="round"
						strokeDasharray={CIRCUMFERENCE} strokeDashoffset={offset}
						style={{transition: 'stroke-dashoffset 0.1s linear'}}
					/>
					<defs>
						<linearGradient id="momentumRingGrad" x1="0" y1="0" x2="1" y2="1">
							<stop offset="0%" stopColor="var(--color-accent)" />
							<stop offset="100%" stopColor="var(--color-growth)" />
						</linearGradient>
					</defs>
				</svg>
				<div className="absolute inset-0 flex flex-col items-center justify-center">
					<span className="text-[26px] font-extrabold tracking-[-0.02em] tabular-nums">
						{streak === null ? '—' : streak}
					</span>
					<span className="text-[10px] uppercase tracking-[0.07em] text-ink/45 mt-1 text-center px-2">
						{streak === null ? 'Loading' : 'Day streak'}
					</span>
				</div>
				{showStreakInfo && streak !== null && (
					<StreakInfoPopover anchorRef={ringRef} streak={streak} longestStreak={longestStreak} days={streakDays} />
				)}
			</div>
		</section>
	)
}

export default MomentumHero
