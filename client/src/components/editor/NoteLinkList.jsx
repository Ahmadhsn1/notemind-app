import {forwardRef, useCallback, useEffect, useImperativeHandle, useState} from 'react'

const NoteLinkList = forwardRef(({items, command}, ref) => {
	const [selectedIndex, setSelectedIndex] = useState(0)

	useEffect(() => setSelectedIndex(0), [items])

	const selectItem = useCallback((index) => {
		const item = items[index]
		if (item) command(item)
	}, [items, command])

	useImperativeHandle(ref, () => ({
		onKeyDown: ({event}) => {
			if (event.key === 'ArrowUp') {
				setSelectedIndex((i) => (i + items.length - 1) % items.length)
				return true
			}
			if (event.key === 'ArrowDown') {
				setSelectedIndex((i) => (i + 1) % items.length)
				return true
			}
			if (event.key === 'Enter') {
				selectItem(selectedIndex)
				return true
			}
			return false
		},
	}), [selectedIndex, items, selectItem])

	return (
		<div className="w-[260px] max-h-[280px] overflow-y-auto p-1.5 rounded-[12px] border border-accent/35 bg-[linear-gradient(160deg,var(--color-panel-a),var(--color-panel-b))] shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
			{items.length === 0 ? (
				<div className="py-3 px-2.5 text-[12.5px] text-ink/45">No matching notes</div>
			) : (
				items.map((item, index) => (
					<button
						key={item.id}
						type="button"
						onMouseEnter={() => setSelectedIndex(index)}
						onClick={() => selectItem(index)}
						className={`w-full flex items-center gap-2.5 py-2 px-2.5 rounded-[8px] text-[13px] text-left cursor-pointer truncate transition-colors duration-100 ${
							index === selectedIndex ? 'bg-accent/18 text-ink' : 'text-ink/70'
						}`}
					>
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-accent">
							<path d="M6 4h9l5 5v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
						</svg>
						<span className="truncate">{item.title}</span>
					</button>
				))
			)}
		</div>
	)
})

NoteLinkList.displayName = 'NoteLinkList'

export default NoteLinkList
