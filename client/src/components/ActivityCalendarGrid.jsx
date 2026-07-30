import {toLocalDateKey} from '../utils/dateKey'

// Count -> fill intensity, GitHub-contribution-graph style — needed here
// (unlike the 7-day bar chart) because Month/Custom ranges can have widely
// varying counts across many small cells, where height differences aren't
// legible at this size.
const COUNT_TIERS = [
	{max: 0, className: 'bg-ink/10'},
	{max: 1, className: 'bg-growth/35'},
	{max: 3, className: 'bg-growth/65'},
	{max: Infinity, className: 'bg-growth'},
]

function tierClass(count) {
	return COUNT_TIERS.find((t) => count <= t.max).className
}

// Monday-first weekday index (0=Mon..6=Sun), unlike Date#getDay() which is
// Sunday-first — used to align the Month grid's leading padding to a
// Mon-Sun week regardless of the browser locale's first-day-of-week.
function mondayIndex(date) {
	return (date.getDay() + 6) % 7
}

function DayCell({date, count, todayKey, selectedDay, onSelectDay, onHoverDay}) {
	const selected = date === selectedDay
	const isToday = date === todayKey
	const label = new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})
	const hover = () => onHoverDay?.({date, count})
	const unhover = () => onHoverDay?.(null)
	return (
		<button
			type="button"
			onClick={() => onSelectDay(date)}
			onMouseEnter={hover}
			onMouseLeave={unhover}
			onFocus={hover}
			onBlur={unhover}
			title={`${label} — ${count} note${count === 1 ? '' : 's'}`}
			aria-pressed={selected}
			aria-label={`${label}: ${count} note${count === 1 ? '' : 's'}${selected ? ' (selected)' : ''}`}
			className={`w-full aspect-square rounded-[4px] cursor-pointer transition-[filter,box-shadow] hover:brightness-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${tierClass(count)} ${
				selected ? 'ring-2 ring-accent' : isToday ? 'ring-1 ring-ink/40' : ''
			}`}
		/>
	)
}

const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

// mode 'month': calendar-aligned Mon-Sun grid with dim, non-interactive
// padding cells for days outside the month, plus a weekday header row.
// mode 'custom': a plain sequential wrap (no calendar alignment) — an
// arbitrary picked range isn't a calendar month, so there's no single
// "correct" week alignment to pad it to.
function ActivityCalendarGrid({mode, days, selectedDay, onSelectDay, onHoverDay}) {
	const todayKey = toLocalDateKey(new Date())

	if (mode === 'month') {
		const firstDate = new Date(`${days[0].date}T00:00:00`)
		const leadingPad = mondayIndex(firstDate)
		const cells = [...new Array(leadingPad).fill(null), ...days]
		const trailingPad = (7 - (cells.length % 7)) % 7
		const paddedCells = [...cells, ...new Array(trailingPad).fill(null)]

		return (
			<div>
				<div className="grid grid-cols-7 gap-1 mb-1">
					{WEEKDAY_LETTERS.map((l, i) => (
						<div key={i} className="text-center text-[9px] font-semibold text-ink/35">{l}</div>
					))}
				</div>
				<div className="grid grid-cols-7 gap-1">
					{paddedCells.map((d, i) =>
						d ? (
							<DayCell key={d.date} date={d.date} count={d.count} todayKey={todayKey} selectedDay={selectedDay} onSelectDay={onSelectDay} onHoverDay={onHoverDay} />
						) : (
							<div key={`pad-${i}`} />
						)
					)}
				</div>
			</div>
		)
	}

	return (
		<div className="grid grid-cols-7 gap-1">
			{days.map((d) => (
				<DayCell key={d.date} date={d.date} count={d.count} todayKey={todayKey} selectedDay={selectedDay} onSelectDay={onSelectDay} onHoverDay={onHoverDay} />
			))}
		</div>
	)
}

export default ActivityCalendarGrid
