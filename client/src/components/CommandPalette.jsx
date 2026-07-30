import {useEffect, useRef, useState} from 'react'
import {Command} from 'cmdk'

const ICONS = {
	newNote: <path d="M12 5v14M5 12h14" />,
	ask: <path d="M12 2l1.8 5.6L19 9.4l-5.2 1.9L12 17l-1.8-5.7L5 9.4l5.2-1.8L12 2Z" fill="currentColor" stroke="none" />,
	folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
	note: <path d="M6 4h9l5 5v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />,
	logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></>,
}

function ItemIcon({d}) {
	return (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ink/45">
			{d}
		</svg>
	)
}

function CommandPalette({notes, folders, onNewNote, onAskAI, onSelectFolder, onViewNote, onLogout, otherModalOpen}) {
	const [open, setOpen] = useState(false)
	// Read fresh on every keypress via a ref rather than a useEffect dependency —
	// the listener is attached once on mount, so this is the only way for it to
	// see the current value of otherModalOpen without churning the subscription.
	const otherModalOpenRef = useRef(otherModalOpen)
	useEffect(() => {
		otherModalOpenRef.current = otherModalOpen
	})

	useEffect(() => {
		const handleKeyDown = (e) => {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
				e.preventDefault()
				// Another modal (note view, editor, ask AI, etc.) already owns the
				// screen — don't stack the palette on top of it.
				if (otherModalOpenRef.current) return
				setOpen((prev) => !prev)
			}
		}
		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [])

	const run = (fn) => {
		setOpen(false)
		fn()
	}

	const itemClass = 'flex items-center gap-2.5 py-2.5 px-3 rounded-[10px] text-[13.5px] text-ink/80 cursor-pointer data-[selected=true]:bg-accent/16 data-[selected=true]:text-ink'

	return (
		<Command.Dialog
			open={open}
			onOpenChange={setOpen}
			label="Command palette"
			overlayClassName="fixed inset-0 bg-[#0a0b10]/60 backdrop-blur-[3px] z-40"
			contentClassName="fixed left-1/2 top-[16%] -translate-x-1/2 z-40 w-full max-w-[540px] px-4"
			shouldFilter
			loop
		>
			<div className="bg-[linear-gradient(160deg,var(--color-panel-a),var(--color-panel-b))] border border-accent/35 rounded-[16px] shadow-[0_24px_60px_rgba(0,0,0,0.5)] overflow-hidden">
				<Command.Input
					autoFocus
					placeholder="Type a command or search notes..."
					className="w-full bg-transparent border-0 border-b border-ink/10 outline-none text-ink text-[14px] placeholder:text-ink/40 py-3.5 px-4"
				/>
				<Command.List className="max-h-[360px] overflow-y-auto p-2">
					<Command.Empty className="py-8 text-center text-[13px] text-ink/45">No results found.</Command.Empty>

					<Command.Group heading="Actions" className="[&_[cmdk-group-heading]]:text-[10.5px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.07em] [&_[cmdk-group-heading]]:text-ink/40 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1.5">
						<Command.Item className={itemClass} onSelect={() => run(onNewNote)}>
							<ItemIcon d={ICONS.newNote} /> New note
						</Command.Item>
						<Command.Item className={itemClass} onSelect={() => run(onAskAI)}>
							<ItemIcon d={ICONS.ask} /> Ask Momo
						</Command.Item>
					</Command.Group>

					{folders.length > 0 && (
						<Command.Group heading="Folders" className="[&_[cmdk-group-heading]]:text-[10.5px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.07em] [&_[cmdk-group-heading]]:text-ink/40 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1.5">
							{folders.map((f) => (
								<Command.Item key={f.name} className={itemClass} onSelect={() => run(() => onSelectFolder(f.name))}>
									<ItemIcon d={ICONS.folder} /> {f.name}
									<span className="ml-auto text-[11px] text-ink/40">{f.count}</span>
								</Command.Item>
							))}
						</Command.Group>
					)}

					{notes.length > 0 && (
						<Command.Group heading="Notes" className="[&_[cmdk-group-heading]]:text-[10.5px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.07em] [&_[cmdk-group-heading]]:text-ink/40 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1.5">
							{notes.map((note) => (
								<Command.Item
									key={note._id}
									className={itemClass}
									keywords={note.body ? [note.body] : undefined}
									onSelect={() => run(() => onViewNote(note))}
								>
									<ItemIcon d={ICONS.note} /> {note.title}
								</Command.Item>
							))}
						</Command.Group>
					)}

					<Command.Group heading="Account" className="[&_[cmdk-group-heading]]:text-[10.5px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.07em] [&_[cmdk-group-heading]]:text-ink/40 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1.5">
						<Command.Item className={itemClass} onSelect={() => run(onLogout)}>
							<ItemIcon d={ICONS.logout} /> Log out
						</Command.Item>
					</Command.Group>
				</Command.List>
			</div>
		</Command.Dialog>
	)
}

export default CommandPalette
