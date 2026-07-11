import {folderColor} from '../utils/folderColor'

function initials(name) {
	if (!name) return '?'
	const parts = name.trim().split(/\s+/)
	return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')
}

function Sidebar({folders, activeFolder, onSelectFolder, onNewNote, onAskAI, userName, onLogout, isOpen, onClose}) {
	const selectFolder = (name) => {
		onSelectFolder(name)
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

	return (
		<>
			<div
				className={`${isOpen ? 'block min-[761px]:hidden' : 'hidden'} fixed inset-0 bg-black/50 z-[35]`}
				onClick={onClose}
			/>
			<aside
				className={`w-[240px] shrink-0 h-screen overflow-y-auto py-[22px] px-4 flex flex-col gap-5 bg-white/3 border-r border-white/10 fixed top-0 left-0 z-40 shadow-[8px_0_30px_rgba(0,0,0,0.4)] [transition:transform_0.25s_ease] ${isOpen ? 'translate-x-0' : '-translate-x-full'} min-[761px]:sticky min-[761px]:left-auto min-[761px]:z-auto min-[761px]:shadow-none min-[761px]:[transition:none] min-[761px]:translate-x-0`}
			>
				<div className="px-1.5">
					<span className="text-[19px] font-bold bg-gradient-to-r from-[#a29bfe] to-[#e84393] bg-clip-text text-transparent">NoteMind</span>
				</div>

				<button onClick={newNote} className="btn-primary p-[11px] text-[13.5px]">+ New note</button>

				<button
					onClick={askAI}
					className="bg-white/8 border border-[#a29bfe]/30 text-[#a29bfe] rounded-[10px] font-semibold cursor-pointer transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-[0.98] p-[11px] text-[13.5px] flex items-center justify-center gap-1.5"
				>
					<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.8 5.6L19 9.4l-5.2 1.9L12 17l-1.8-5.7L5 9.4l5.2-1.8L12 2Z" /></svg>
					Ask Momo
				</button>

				<div>
					<div className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-white/40 px-2.5 mb-1">Folders</div>
					<div className="flex flex-col gap-0.5">
						{folders.map((f) => {
							const active = f.name === activeFolder
							return (
								<div
									key={f.name}
									onClick={() => selectFolder(f.name)}
									className={`flex items-center gap-2.5 py-[9px] px-2.5 rounded-[10px] cursor-pointer border text-[13.5px] transition-colors duration-150 ${active ? 'bg-[#a29bfe]/14 border-[#a29bfe]/45 text-white' : 'border-transparent text-white/62 hover:bg-white/6 hover:text-white'}`}
								>
									<span
										className="w-2 h-2 rounded-full shrink-0"
										style={{background: f.name === 'All' ? 'linear-gradient(135deg,#a29bfe,#e84393)' : folderColor(f.name)}}
									/>
									<span className="flex-1">{f.name}</span>
									<span className={`text-[11px] font-semibold py-px px-[7px] rounded-full ${active ? 'text-[#a29bfe] bg-[#a29bfe]/16' : 'text-white/42 bg-white/6'}`}>{f.count}</span>
								</div>
							)
						})}
					</div>
				</div>

				<div className="mt-auto flex items-center gap-2.5 p-2.5 border-t border-white/10">
					<div className="w-[30px] h-[30px] rounded-full shrink-0 bg-gradient-to-br from-[#a29bfe] to-[#e84393] flex items-center justify-center text-xs font-bold text-[#1a1443]">{initials(userName)}</div>
					<div className="truncate flex-1 text-[13px] font-semibold">{userName}</div>
					<button
						onClick={onLogout}
						aria-label="Log out"
						className="w-[30px] h-[30px] p-0 rounded-[8px] bg-transparent border-none text-white/42 text-sm font-semibold cursor-pointer transition-[opacity,transform] duration-200 hover:bg-[#d63031]/18 hover:text-[#ff7675] hover:opacity-100 active:scale-[0.98]"
					>⏻</button>
				</div>
			</aside>
		</>
	)
}

export default Sidebar
