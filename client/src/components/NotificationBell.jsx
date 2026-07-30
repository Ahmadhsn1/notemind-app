import {useEffect, useLayoutEffect, useRef, useState} from 'react'
import {createPortal} from 'react-dom'
import {computePosition, offset, flip, shift} from '@floating-ui/dom'
import {useNotifications} from '../context/NotificationContext'
import {relativeTime} from '../utils/relativeTime'

// Click-toggled dropdown (not hover, since this is a persistent inbox the
// user needs time to read, not a transient info readout) — positioned with
// the same computePosition approach as StreakInfoPopover.jsx, portaled to
// document.body so it's never clipped by TopBar's own layout.
function NotificationBell() {
	const {notifications, unreadCount, markRead} = useNotifications()
	const [open, setOpen] = useState(false)
	const btnRef = useRef(null)
	const popRef = useRef(null)

	useLayoutEffect(() => {
		if (!open || !btnRef.current || !popRef.current) return
		computePosition(btnRef.current, popRef.current, {
			strategy: 'fixed',
			placement: 'bottom-end',
			middleware: [offset(10), flip(), shift({padding: 8})],
		}).then(({x, y}) => {
			if (popRef.current) Object.assign(popRef.current.style, {left: `${x}px`, top: `${y}px`})
		})
	})

	useEffect(() => {
		if (!open) return
		const handleOutside = (e) => {
			if (!btnRef.current?.contains(e.target) && !popRef.current?.contains(e.target)) setOpen(false)
		}
		const handleKey = (e) => {
			if (e.key === 'Escape') setOpen(false)
		}
		document.addEventListener('mousedown', handleOutside)
		document.addEventListener('keydown', handleKey)
		return () => {
			document.removeEventListener('mousedown', handleOutside)
			document.removeEventListener('keydown', handleKey)
		}
	}, [open])

	return (
		<>
			<button
				ref={btnRef}
				type="button"
				onClick={() => setOpen((v) => !v)}
				aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
				className="relative w-9 h-9 p-0 shrink-0 rounded-[10px] flex items-center justify-center bg-ink/8 border border-ink/15 text-ink cursor-pointer transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-[0.98]"
			>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
					<path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
					<path d="M10 20a2 2 0 0 0 4 0" />
				</svg>
				{unreadCount > 0 && (
					<span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-danger text-[9px] font-bold text-white flex items-center justify-center">
						{unreadCount > 9 ? '9+' : unreadCount}
					</span>
				)}
			</button>
			{open && createPortal(
				<div
					ref={popRef}
					className="fixed z-[60] w-[300px] max-h-[360px] overflow-y-auto bg-[linear-gradient(160deg,var(--color-panel-a),var(--color-panel-b))] border border-accent/35 rounded-[14px] shadow-[0_16px_40px_rgba(0,0,0,0.4)]"
				>
					<div className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-accent px-3.5 pt-3 pb-2">Notifications</div>
					{notifications.length === 0 ? (
						<div className="text-[12.5px] text-ink/40 px-3.5 pb-3.5">No notifications yet.</div>
					) : (
						<div className="flex flex-col">
							{notifications.map((n) => (
								<button
									key={n._id}
									type="button"
									onClick={() => !n.read && markRead(n._id)}
									className={`text-left px-3.5 py-2.5 border-t border-ink/8 cursor-pointer transition-colors hover:bg-ink/6 ${n.read ? '' : 'bg-accent/8'}`}
								>
									<p className={`text-[12.5px] leading-[1.4] ${n.read ? 'text-ink/55' : 'text-ink/90 font-medium'}`}>{n.message}</p>
									<span className="text-[10.5px] text-ink/35 mt-1 block">{relativeTime(n.createdAt)}</span>
								</button>
							))}
						</div>
					)}
				</div>,
				document.body
			)}
		</>
	)
}

export default NotificationBell
