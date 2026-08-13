import {useRef, useState} from 'react'
import api from '../api/axios'
import useModalA11y from '../hooks/useModalA11y'
import {useToast} from '../context/ToastContext'

// Recipients are resolved server-side to a concrete list at send time (see
// adminController.sendNotification) — this just collects the admin's
// intent (all / a checked subset / one radio-picked user).
function SendNotificationModal({users, onClose, onSent}) {
	const [message, setMessage] = useState('')
	const [targetType, setTargetType] = useState('all')
	const [selectedIds, setSelectedIds] = useState([])
	const [sending, setSending] = useState(false)
	const toast = useToast()
	// No isOpen prop here — Admin.jsx only mounts this component while it's
	// shown, unlike the other dialogs' own internal isOpen-gated return null.
	// Passing a constant `true` makes useModalA11y's "run once per open"
	// effect fire on mount and clean up on unmount, which is the equivalent
	// transition for a component that IS the open state.
	const panelRef = useRef(null)
	useModalA11y(true, onClose, panelRef)

	const toggleUser = (id) => {
		setSelectedIds((prev) => {
			if (targetType === 'single') return [id]
			return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
		})
	}

	const handleSend = async (e) => {
		e.preventDefault()
		if (!message.trim() || sending) return
		if (targetType !== 'all' && selectedIds.length === 0) {
			toast.error('Pick at least one recipient.')
			return
		}

		setSending(true)
		try {
			await api.post('/admin/notifications', {
				message: message.trim(),
				targetType,
				userIds: targetType === 'all' ? undefined : selectedIds,
			})
			toast.success('Notification sent.')
			onSent?.()
			onClose()
		} catch (err) {
			toast.error(err.response?.data?.message || 'Could not send notification.')
		} finally {
			setSending(false)
		}
	}

	return (
		<div
			className="fixed inset-0 bg-[#0a0b10]/60 backdrop-blur-[3px] flex items-center justify-center z-30 p-4"
			onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
		>
			<div
				ref={panelRef}
				role="dialog"
				aria-modal="true"
				aria-label="Send notification"
				tabIndex={-1}
				className="w-full max-w-[440px] bg-[linear-gradient(160deg,var(--color-panel-a),var(--color-panel-b))] border border-accent/35 rounded-[20px] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.45)] flex flex-col gap-3.5 max-h-[85vh] overflow-y-auto outline-none"
			>
				<div className="flex items-center justify-between">
					<h3 className="text-base font-bold">Send notification</h3>
					<button
						onClick={onClose}
						aria-label="Close"
						className="w-7 h-7 p-0 rounded-[8px] bg-ink/6 border-none text-ink/62 text-xs font-semibold cursor-pointer transition-[opacity,transform] duration-200 hover:bg-ink/10 active:scale-[0.98]"
					>✕</button>
				</div>

				<form onSubmit={handleSend} className="flex flex-col gap-3">
					<textarea
						value={message}
						onChange={(e) => setMessage(e.target.value)}
						placeholder="Notification message..."
						rows={3}
						maxLength={1000}
						autoFocus
						className="input-base w-full resize-none"
					/>

					<div className="flex gap-1.5">
						{[['all', 'All users'], ['selected', 'Selected'], ['single', 'Single user']].map(([key, label]) => (
							<button
								key={key}
								type="button"
								onClick={() => { setTargetType(key); setSelectedIds([]) }}
								className={`flex-1 py-2 rounded-[8px] text-[12.5px] font-semibold cursor-pointer transition-colors ${
									targetType === key ? 'bg-accent/22 text-accent border border-accent/40' : 'bg-ink/6 border border-ink/12 text-ink/60 hover:text-ink'
								}`}
							>{label}</button>
						))}
					</div>

					{targetType !== 'all' && (
						<div className="max-h-[180px] overflow-y-auto rounded-[10px] border border-ink/12 flex flex-col">
							{users.map((u) => (
								<label key={u._id} className="flex items-center gap-2 px-3 py-2 border-b border-ink/6 last:border-0 cursor-pointer hover:bg-ink/5 text-[12.5px]">
									<input
										type={targetType === 'single' ? 'radio' : 'checkbox'}
										name="recipient"
										checked={selectedIds.includes(u._id)}
										onChange={() => toggleUser(u._id)}
									/>
									<span className="truncate">{u.name} <span className="text-ink/40">({u.email})</span></span>
								</label>
							))}
						</div>
					)}

					<div className="flex gap-2.5 mt-1">
						<button
							type="button"
							onClick={onClose}
							className="bg-ink/8 border border-ink/20 text-ink rounded-[10px] font-semibold cursor-pointer transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-[0.98] flex-1 p-[11px] text-[13.5px]"
						>Cancel</button>
						<button
							type="submit"
							disabled={sending || !message.trim()}
							className="btn-primary flex-1 p-[11px] text-[13.5px] disabled:opacity-50 disabled:cursor-not-allowed"
						>{sending ? 'Sending…' : 'Send'}</button>
					</div>
				</form>
			</div>
		</div>
	)
}

export default SendNotificationModal
