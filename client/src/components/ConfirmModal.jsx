import {useRef, useState} from 'react'
import useModalA11y from '../hooks/useModalA11y'

// Owns the in-flight state for the confirm action rather than leaving it to
// each caller. Every consumer's handler follows the same shape — check a
// `target` state, await a DELETE, then clear the target — which means the
// guard only takes effect *after* the request resolves. A second click landing
// before that fired the destructive request twice: two DELETE calls, and in
// Admin.jsx an optimistic `totalUsers - 1` applied twice, so one deletion
// dropped the displayed count by two. Awaiting onConfirm here fixes every
// caller at once, with no change needed at the call sites.
function ConfirmModal({isOpen, title, message, confirmLabel = 'Confirm', onConfirm, onCancel}) {
	const [busy, setBusy] = useState(false)
	const panelRef = useRef(null)
	// Escape mirrors the backdrop click's own busy-guard — no dismissing
	// mid-request, same reason the buttons below are disabled(busy).
	useModalA11y(isOpen, () => { if (!busy) onCancel() }, panelRef)

	if (!isOpen) return null

	// The finally is what keeps `busy` correct across reopenings — this
	// component stays mounted between them (isOpen only gates the render), so
	// a path that left busy set would disable every subsequent confirm.
	const handleConfirm = async () => {
		if (busy) return
		setBusy(true)
		try {
			await onConfirm()
		} finally {
			setBusy(false)
		}
	}

	return (
		<div
			className="fixed inset-0 bg-[#0a0b10]/60 backdrop-blur-[3px] flex items-center justify-center z-30 p-4 min-[381px]:p-6"
			onClick={(e) => { if (e.target === e.currentTarget && !busy) onCancel() }}
		>
			<div
				ref={panelRef}
				role="dialog"
				aria-modal="true"
				aria-label={title}
				tabIndex={-1}
				className="w-full max-w-[380px] bg-[linear-gradient(160deg,var(--color-panel-a),var(--color-panel-b))] border border-accent/35 rounded-[20px] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.45)] outline-none"
			>
				<h3 className="text-base font-bold mb-2">{title}</h3>
				<p className="text-[13px] text-ink/60 leading-[1.5] mb-5">{message}</p>

				<div className="flex justify-end gap-2">
					<button
						onClick={onCancel}
						disabled={busy}
						className="py-[9px] px-4 text-[13px] font-semibold rounded-[10px] bg-ink/6 border border-ink/12 text-ink/75 cursor-pointer transition-[opacity,transform] duration-200 hover:bg-ink/10 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
					>Cancel</button>
					<button
						onClick={handleConfirm}
						disabled={busy}
						className="py-[9px] px-4 text-[13px] font-semibold rounded-[10px] bg-danger border-none text-ink cursor-pointer transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
					>{busy ? 'Working…' : confirmLabel}</button>
				</div>
			</div>
		</div>
	)
}

export default ConfirmModal
