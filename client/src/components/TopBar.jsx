function TopBar({searchQuery, onSearchChange, sortMode, onSortChange, viewMode, onViewChange, onOpenSidebar}) {
	const toggleBtnBase = 'w-9 h-9 p-0 rounded-none flex items-center justify-center text-sm font-semibold cursor-pointer transition-[opacity,transform] duration-200 active:scale-[0.98]'
	const toggleBtnActive = 'bg-[#a29bfe]/16 text-[#a29bfe] opacity-100'
	const toggleBtnInactive = 'bg-transparent text-white/42 hover:opacity-90'

	return (
		<div className="flex items-center gap-2.5 mb-5 flex-wrap min-[761px]:flex-nowrap">
			<button
				onClick={onOpenSidebar}
				aria-label="Open menu"
				className="flex min-[761px]:hidden w-9 h-9 p-0 shrink-0 items-center justify-center rounded-[10px] bg-white/8 border border-white/15 text-white text-[15px] cursor-pointer transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-[0.98]"
			>☰</button>

			<div className="flex-[1_1_160px] max-w-none min-[761px]:flex-1 min-[761px]:max-w-[380px]">
				<input
					type="text"
					placeholder="Search notes..."
					value={searchQuery}
					onChange={(e) => onSearchChange(e.target.value)}
					className="input-base w-full"
				/>
			</div>

			<select
				value={sortMode}
				onChange={(e) => onSortChange(e.target.value)}
				className="input-base w-auto"
			>
				<option value="newest">Newest first</option>
				<option value="oldest">Oldest first</option>
				<option value="az">Title A–Z</option>
			</select>

			<div className="flex border border-white/13 rounded-[10px] overflow-hidden">
				<button
					onClick={() => onViewChange('grid')}
					aria-label="Grid view"
					className={`${toggleBtnBase} ${viewMode === 'grid' ? toggleBtnActive : toggleBtnInactive}`}
				>▦</button>
				<button
					onClick={() => onViewChange('list')}
					aria-label="List view"
					className={`${toggleBtnBase} ${viewMode === 'list' ? toggleBtnActive : toggleBtnInactive}`}
				>☰</button>
			</div>
		</div>
	)
}

export default TopBar
