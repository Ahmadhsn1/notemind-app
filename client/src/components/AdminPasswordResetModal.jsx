import {useRef, useState} from 'react'
import useModalA11y from '../hooks/useModalA11y'

// Shows a generated temp password exactly once (the server never stores or
// re-serves it) — a modal with a copy button, not a toast, since a toast
// vanishing in a few seconds isn't enough time to actually relay this to
// the user it's for.
function AdminPasswordResetModal({result, onClose}) {
	const [copied, setCopied] = useState(false)
	// No isOpen prop — the parent only mounts this while a result exists
	// (see Admin.jsx's own {passwordResetResult && <...>}), so a constant
	// `true` makes useModalA11y's "run once per open" effect fire on mount
	// and clean up on unmount, the equivalent transition here.
	const panelRef = useRef(null)
	useModalA11y(true, onClose, panelRef)

	if (!result) return null

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(result.tempPassword)
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		} catch {
			// Clipboard API can fail (permissions, insecure context) — the
			// password stays visible on-screen either way, so there's still a
			// way to relay it manually.
		}
	}

	return (
		<div
			className="fixed inset-0 bg-[#0a0b10]/60 backdrop-blur-[3px] flex items-center justify-center z-30 p-4 min-[381px]:p-6"
			onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
		>
			<div
				ref={panelRef}
				role="dialog"
				aria-modal="true"
				aria-label="Temporary password"
				tabIndex={-1}
				className="w-full max-w-[380px] bg-[linear-gradient(160deg,var(--color-panel-a),var(--color-panel-b))] border border-accent/35 rounded-[20px] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.45)] outline-none"
			>
				<h3 className="text-base font-bold mb-2">Temporary password</h3>
				<p className="text-[13px] text-ink/60 leading-[1.5] mb-4">
					For <strong className="text-ink/80">{result.name}</strong>. Share it with them securely — it won't be shown again.
				</p>
				<div className="flex items-center gap-2 mb-5">
					<code className="flex-1 py-2.5 px-3 rounded-[10px] bg-ink/8 border border-ink/15 text-[14px] font-mono tracking-wide select-all">{result.tempPassword}</code>
					<button
						onClick={handleCopy}
						className="shrink-0 py-2.5 px-3 rounded-[10px] text-[12px] font-semibold bg-ink/8 border border-ink/15 text-ink/75 cursor-pointer transition-colors duration-150 hover:bg-ink/12"
					>{copied ? 'Copied!' : 'Copy'}</button>
				</div>
				<button onClick={onClose} className="btn-primary w-full py-[11px] text-[13.5px]">Done</button>
			</div>
		</div>
	)
}

export default AdminPasswordResetModal
