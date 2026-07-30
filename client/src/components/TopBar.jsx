import {useTheme} from '../context/ThemeContext'

function TopBar({searchQuery, onSearchChange, sortMode, onSortChange, viewMode, onViewChange, onOpenSidebar}) {
	const {theme, toggleTheme} = useTheme()
	const toggleBtnBase = 'w-9 h-9 p-0 rounded-none flex items-center justify-center text-sm font-semibold cursor-pointer transition-[opacity,transform] duration-200 active:scale-[0.98]'
	const toggleBtnActive = 'bg-accent/16 text-accent opacity-100'
	const toggleBtnInactive = 'bg-transparent text-ink/42 hover:opacity-90'

	return (
		<div className="flex items-center justify-between gap-2.5 mb-5 flex-wrap min-[761px]:flex-nowrap">
			<div className="flex items-center gap-2.5 flex-1 min-w-0">
				<button
					onClick={onOpenSidebar}
					aria-label="Open menu"
					className="flex min-[761px]:hidden w-9 h-9 p-0 shrink-0 items-center justify-center rounded-[10px] bg-ink/8 border border-ink/15 text-ink text-[15px] cursor-pointer transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-[0.98]"
				>☰</button>

				<div className="relative flex-1 min-w-[160px] max-w-[520px]">
					<input
						type="text"
						placeholder="Search notes..."
						value={searchQuery}
						onChange={(e) => onSearchChange(e.target.value)}
						className="input-base w-full pr-14"
					/>
					<kbd className="hidden min-[481px]:flex absolute right-2.5 top-1/2 -translate-y-1/2 items-center gap-0.5 py-1 px-1.5 rounded-[6px] bg-ink/8 border border-ink/12 text-[10.5px] font-semibold text-ink/40">
						⌘K
					</kbd>
				</div>
			</div>

			<div className="flex items-center gap-2.5 shrink-0">
				<select
					value={sortMode}
					onChange={(e) => onSortChange(e.target.value)}
					className="input-base w-auto"
				>
					<option value="newest">Newest first</option>
					<option value="oldest">Oldest first</option>
					<option value="az">Title A–Z</option>
				</select>

				<div className="flex border border-ink/13 rounded-[10px] overflow-hidden">
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

				<button
					onClick={toggleTheme}
					aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
					title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
					className="w-9 h-9 p-0 shrink-0 rounded-[10px] flex items-center justify-center bg-ink/8 border border-ink/15 text-ink cursor-pointer transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-[0.98]"
				>
					{theme === 'dark' ? (
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<circle cx="12" cy="12" r="4" />
							<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
						</svg>
					) : (
						<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
							<path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 1020.354 15.354Z" />
						</svg>
					)}
				</button>
			</div>
		</div>
	)
}

export default TopBar
