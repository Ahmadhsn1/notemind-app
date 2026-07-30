import {forwardRef, useCallback, useEffect, useImperativeHandle, useState} from 'react'

const SlashCommandList = forwardRef(({items, command}, ref) => {
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
		<div className="w-[230px] max-h-[280px] overflow-y-auto p-1.5 rounded-[12px] border border-accent/35 bg-[linear-gradient(160deg,var(--color-panel-a),var(--color-panel-b))] shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
			{items.length === 0 ? (
				<div className="py-3 px-2.5 text-[12.5px] text-ink/45">No matching blocks</div>
			) : (
				items.map((item, index) => (
					<button
						key={item.key}
						type="button"
						onMouseEnter={() => setSelectedIndex(index)}
						onClick={() => selectItem(index)}
						className={`w-full flex items-center gap-2.5 py-2 px-2.5 rounded-[8px] text-[13px] text-left cursor-pointer transition-colors duration-100 ${
							index === selectedIndex ? 'bg-accent/18 text-ink' : 'text-ink/70'
						}`}
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill={item.fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-accent">
							{item.icon}
						</svg>
						{item.title}
					</button>
				))
			)}
		</div>
	)
})

SlashCommandList.displayName = 'SlashCommandList'

export default SlashCommandList
