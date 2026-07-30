import {useLayoutEffect, useRef} from 'react'
import {createPortal} from 'react-dom'
import {computePosition, offset, flip, shift} from '@floating-ui/dom'

// Anchored to the streak ring the same way the editor's slash-command/
// note-link popups anchor to text (computePosition + offset/flip/shift, see
// components/editor/noteLinkExtension.js) — portaled to document.body with
// position: fixed so it's never clipped by an ancestor's overflow, with
// strategy: 'fixed' to match that same fixed-position coordinate space.
function StreakInfoPopover({anchorRef, streak, longestStreak, days}) {
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

	const todayStr = (() => {
		const d = new Date()
		const y = d.getFullYear()
		const m = String(d.getMonth() + 1).padStart(2, '0')
		const day = String(d.getDate()).padStart(2, '0')
		return `${y}-${m}-${day}`
	})()

	return createPortal(
		<div
			ref={popRef}
			className="fixed z-[60] w-[248px] bg-[linear-gradient(160deg,var(--color-panel-a),var(--color-panel-b))] border border-accent/35 rounded-[14px] p-3.5 shadow-[0_16px_40px_rgba(0,0,0,0.4)]"
		>
			<div className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-accent mb-2">Your streak</div>
			<div className="text-[13px] text-ink/80 mb-3">
				<span className="font-bold">{streak}</span> day{streak === 1 ? '' : 's'} in a row
				{longestStreak > streak && (
					<span className="text-ink/50"> · best {longestStreak}</span>
				)}
			</div>
			<div className="grid grid-cols-7 gap-1.5">
				{days.map((d) => (
					<div
						key={d.date}
						title={`${new Date(`${d.date}T00:00:00`).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}${d.active ? ' — active' : ''}`}
						className={`w-5 h-5 rounded-[5px] ${d.active ? 'bg-growth' : 'bg-ink/10'} ${d.date === todayStr ? 'ring-2 ring-accent ring-offset-1 ring-offset-ink-deep' : ''}`}
					/>
				))}
			</div>
			<div className="text-[10px] text-ink/35 mt-2">Last 14 days</div>
		</div>,
		document.body
	)
}

export default StreakInfoPopover
