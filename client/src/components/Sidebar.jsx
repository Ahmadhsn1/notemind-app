import {Link} from 'react-router-dom'
import {folderColor} from '../utils/folderColor'
import Logo from './Logo'

function initials(name) {
	if (!name) return '?'
	const parts = name.trim().split(/\s+/)
	return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')
}

function Sidebar({folders, activeFolder, onSelectFolder, tags, activeTag, onSelectTag, onNewNote, onAskAI, onOpenFlashcards, userName, isAdmin, onLogout, isOpen, onClose, view, onViewChange}) {
	const selectFolder = (name) => {
		onSelectFolder(name)
		onViewChange('active')
		onClose()
	}

	// Mirrors selectFolder — a tag is a filter exactly like a folder, so
	// picking one also snaps back to the active view and closes the mobile
	// drawer the same way. Toggling (same tag clicked again clears it) lives
	// in Dashboard's onSelectTag itself, matching MomentumHero's onSelectDay.
	const selectTag = (name) => {
		onSelectTag(name)
		onViewChange('active')
		onClose()
	}

	const newNote = () => {
		onNewNote()
		onClose()
	}

	const askAI = () => {
		onAskAI()
		onClose()
	}

	const openFlashcards = () => {
		onOpenFlashcards()
		onClose()
	}

	const selectView = (name) => {
		onViewChange(name)
		onClose()
	}

	return (
		<>
			<div
				className={`${isOpen ? 'block min-[761px]:hidden' : 'hidden'} fixed inset-0 bg-black/50 z-[35]`}
				onClick={onClose}
			/>
			<aside
				className={`w-[240px] shrink-0 h-screen overflow-y-auto py-[22px] px-4 flex flex-col gap-5 bg-ink/3 border-r border-ink/10 fixed top-0 left-0 z-40 shadow-[8px_0_30px_rgba(0,0,0,0.4)] [transition:transform_0.25s_ease] ${isOpen ? 'translate-x-0' : '-translate-x-full'} min-[761px]:sticky min-[761px]:left-auto min-[761px]:z-auto min-[761px]:shadow-none min-[761px]:[transition:none] min-[761px]:translate-x-0`}
			>
				<div className="px-1.5">
					<Logo />
				</div>

				<button onClick={newNote} className="btn-primary p-[11px] text-[13.5px]">+ New note</button>

				<button
					onClick={askAI}
					className="bg-ink/8 border border-accent/30 text-accent rounded-[10px] font-semibold cursor-pointer transition-[opacity,transform] duration-200 hover:opacity-90 hover:-translate-y-px active:scale-[0.98] p-[11px] text-[13.5px] flex items-center justify-center gap-1.5"
				>
					<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.8 5.6L19 9.4l-5.2 1.9L12 17l-1.8-5.7L5 9.4l5.2-1.8L12 2Z" /></svg>
					Ask Momo
				</button>

				<Link
					to="/graph"
					onClick={onClose}
					className="bg-ink/6 border border-ink/12 text-ink/70 rounded-[10px] font-semibold cursor-pointer transition-[opacity,transform] duration-200 hover:opacity-90 hover:text-ink hover:-translate-y-px active:scale-[0.98] p-[11px] text-[13.5px] flex items-center justify-center gap-1.5"
				>
					<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="8" r="2.5" /><circle cx="9" cy="18" r="2.5" /><path d="M8 7.5l7.5-.5M7.5 8l1 8" /></svg>
					Graph view
				</Link>

				<button
					onClick={openFlashcards}
					className="bg-ink/6 border border-ink/12 text-ink/70 rounded-[10px] font-semibold cursor-pointer transition-[opacity,transform] duration-200 hover:opacity-90 hover:text-ink hover:-translate-y-px active:scale-[0.98] p-[11px] text-[13.5px] flex items-center justify-center gap-1.5"
				>
					<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="14" height="10" rx="2" /><path d="M8 20h9" /><path d="M13 15v5" /></svg>
					Flashcards
				</button>

				{isAdmin && (
					<Link
						to="/admin"
						onClick={onClose}
						className="bg-ink/6 border border-ink/12 text-ink/70 rounded-[10px] font-semibold cursor-pointer transition-[opacity,transform] duration-200 hover:opacity-90 hover:text-ink hover:-translate-y-px active:scale-[0.98] p-[11px] text-[13.5px] flex items-center justify-center gap-1.5"
					>
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 3 6v6c0 5 3.8 8.5 9 10 5.2-1.5 9-5 9-10V6l-9-4Z" /></svg>
						Admin
					</Link>
				)}

				<div>
					<div className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-ink/40 px-2.5 mb-1">Folders</div>
					<div className="flex flex-col gap-0.5">
						{folders.map((f) => {
							const active = f.name === activeFolder
							return (
								<div
									key={f.name}
									onClick={() => selectFolder(f.name)}
									className={`flex items-center gap-2.5 py-[9px] px-2.5 rounded-[10px] cursor-pointer border text-[13.5px] transition-colors duration-150 ${active ? 'bg-accent/14 border-accent/45 text-ink' : 'border-transparent text-ink/62 hover:bg-ink/6 hover:text-ink'}`}
								>
									<span
										className="w-2 h-2 rounded-full shrink-0"
										style={{background: f.name === 'All' ? 'linear-gradient(135deg,var(--color-accent),var(--color-growth))' : folderColor(f.name)}}
									/>
									<span className="flex-1">{f.name}</span>
									<span className={`text-[11px] font-semibold py-px px-[7px] rounded-full ${active ? 'text-accent bg-accent/16' : 'text-ink/42 bg-ink/6'}`}>{f.count}</span>
								</div>
							)
						})}
					</div>
				</div>

				{tags.length > 0 && (
					<div>
						<div className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-ink/40 px-2.5 mb-1">Tags</div>
						{/* Capped and scrollable, unlike Folders above — a folder count
						    stays small in practice, but AI auto-tagging can produce far
						    more tags than fit without pushing Library out of view. */}
						<div className="flex flex-col gap-0.5 max-h-[168px] overflow-y-auto">
							{tags.map((t) => {
								const active = t.name === activeTag
								return (
									<div
										key={t.name}
										onClick={() => selectTag(t.name)}
										className={`flex items-center gap-2.5 py-[9px] px-2.5 rounded-[10px] cursor-pointer border text-[13.5px] transition-colors duration-150 ${active ? 'bg-accent/14 border-accent/45 text-ink' : 'border-transparent text-ink/62 hover:bg-ink/6 hover:text-ink'}`}
									>
										<span className="flex-1 truncate">#{t.name}</span>
										<span className={`text-[11px] font-semibold py-px px-[7px] rounded-full ${active ? 'text-accent bg-accent/16' : 'text-ink/42 bg-ink/6'}`}>{t.count}</span>
									</div>
								)
							})}
						</div>
					</div>
				)}

				<div className="flex flex-col gap-0.5">
					<div className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-ink/40 px-2.5 mb-1">Library</div>
					{[
						{key: 'archived', label: 'Archive', icon: <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2H3V7Z M4 9h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9Z M10 13h4" />},
						{key: 'trash', label: 'Trash', icon: <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" />},
					].map(({key, label, icon}) => {
						const active = view === key
						return (
							<div
								key={key}
								onClick={() => selectView(key)}
								className={`flex items-center gap-2.5 py-[9px] px-2.5 rounded-[10px] cursor-pointer border text-[13.5px] transition-colors duration-150 ${active ? 'bg-accent/14 border-accent/45 text-ink' : 'border-transparent text-ink/62 hover:bg-ink/6 hover:text-ink'}`}
							>
								<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">{icon}</svg>
								<span className="flex-1">{label}</span>
							</div>
						)
					})}
				</div>

				<div className="mt-auto flex items-center gap-1">
					<Link
						to="/features"
						onClick={onClose}
						className="flex-1 flex items-center gap-2 py-2 px-2.5 rounded-[10px] text-[12.5px] font-medium text-ink/45 no-underline cursor-pointer transition-colors duration-150 hover:bg-ink/6 hover:text-ink/75"
					>
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
						Features
					</Link>
					<Link
						to="/whats-new"
						onClick={onClose}
						className="flex-1 flex items-center gap-2 py-2 px-2.5 rounded-[10px] text-[12.5px] font-medium text-ink/45 no-underline cursor-pointer transition-colors duration-150 hover:bg-ink/6 hover:text-ink/75"
					>
						<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="shrink-0"><path d="M12 2l1.8 5.6L19 9.4l-5.2 1.9L12 17l-1.8-5.7L5 9.4l5.2-1.8L12 2Z" /></svg>
						What's new
					</Link>
				</div>

				<div className="flex items-center gap-2.5 p-2.5 border-t border-ink/10">
					<Link
						to="/account"
						onClick={onClose}
						className="flex items-center gap-2.5 flex-1 min-w-0 no-underline text-inherit rounded-[8px] py-1 -my-1 transition-opacity duration-150 hover:opacity-80"
					>
						<div className="w-[30px] h-[30px] rounded-full shrink-0 bg-gradient-to-br from-accent to-growth flex items-center justify-center text-xs font-bold text-[#14161c]">{initials(userName)}</div>
						<div className="truncate flex-1 text-[13px] font-semibold">{userName}</div>
					</Link>
					<button
						onClick={onLogout}
						aria-label="Log out"
						className="w-[30px] h-[30px] p-0 shrink-0 rounded-[8px] bg-transparent border-none text-ink/42 text-sm font-semibold cursor-pointer transition-[opacity,transform] duration-200 hover:bg-danger/18 hover:text-danger-light hover:opacity-100 active:scale-[0.98]"
					>⏻</button>
				</div>
			</aside>
		</>
	)
}

export default Sidebar
