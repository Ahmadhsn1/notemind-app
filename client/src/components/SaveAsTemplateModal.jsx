import {useEffect, useRef, useState} from 'react'
import useModalA11y from '../hooks/useModalA11y'

// A focused, single-field dialog — just the name, since title/contentHtml
// are already known (whatever the note form currently holds) by the time
// this opens. Mirrors ConfirmModal's busy-state pattern: onSave stays
// pending until the request resolves, so a slow connection can't double-fire
// the create by way of a second click.
function SaveAsTemplateModal({isOpen, defaultName, onSave, onCancel}) {
	const [name, setName] = useState('')
	const [busy, setBusy] = useState(false)
	const panelRef = useRef(null)
	const inputRef = useRef(null)

	// Re-seed from the note's current title every time the dialog opens, not
	// just on first mount — this component, like the other modals in this
	// app, can stay mounted between opens.
	/* eslint-disable react-hooks/set-state-in-effect -- syncing to the isOpen/defaultName props, not derived local state; only re-runs on open or a genuinely new default */
	useEffect(() => {
		if (isOpen) setName(defaultName || '')
	}, [isOpen, defaultName])
	/* eslint-enable react-hooks/set-state-in-effect */

	useModalA11y(isOpen, () => { if (!busy) onCancel() }, panelRef)

	if (!isOpen) return null

	const trimmed = name.trim()

	const handleSubmit = async (e) => {
		e.preventDefault()
		if (busy || !trimmed) return
		setBusy(true)
		try {
			await onSave(trimmed)
		} finally {
			setBusy(false)
		}
	}

	return (
		<div
			className="fixed inset-0 bg-[#0a0b10]/60 backdrop-blur-[3px] flex items-center justify-center z-30 p-4 min-[381px]:p-6"
			onClick={(e) => { if (e.target === e.currentTarget && !busy) onCancel() }}
		>
			<form
				onSubmit={handleSubmit}
				ref={panelRef}
				role="dialog"
				aria-modal="true"
				aria-label="Save as template"
				tabIndex={-1}
				className="w-full max-w-[380px] bg-[linear-gradient(160deg,var(--color-panel-a),var(--color-panel-b))] border border-accent/35 rounded-[20px] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.45)] outline-none"
			>
				<h3 className="text-base font-bold mb-1.5">Save as template</h3>
				<p className="text-[13px] text-ink/60 leading-[1.5] mb-4">This note's title and content will be saved as a reusable template you can pick from later — editable and deletable anytime.</p>

				<input
					ref={inputRef}
					type="text"
					placeholder="Template name"
					value={name}
					onChange={(e) => setName(e.target.value)}
					autoFocus
					maxLength={80}
					className="input-base w-full mb-5"
				/>

				<div className="flex justify-end gap-2">
					<button
						type="button"
						onClick={onCancel}
						disabled={busy}
						className="py-[9px] px-4 text-[13px] font-semibold rounded-[10px] bg-ink/6 border border-ink/12 text-ink/75 cursor-pointer transition-[opacity,transform] duration-200 hover:bg-ink/10 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
					>Cancel</button>
					<button
						type="submit"
						disabled={busy || !trimmed}
						className="btn-primary py-[9px] px-4 text-[13px] disabled:opacity-60 disabled:cursor-not-allowed"
					>{busy ? 'Saving…' : 'Save template'}</button>
				</div>
			</form>
		</div>
	)
}

export default SaveAsTemplateModal
