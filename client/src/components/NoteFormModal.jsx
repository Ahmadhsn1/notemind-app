import {useEffect, useRef, useState} from 'react'
import api from '../api/axios'
import NoteEditor from './NoteEditor'
import ConfirmModal from './ConfirmModal'
import useModalA11y from '../hooks/useModalA11y'
import {useToast} from '../context/ToastContext'

function NoteFormModal({
	isOpen,
	isEditing,
	title,
	contentHtml,
	legacyBody,
	bodyPlainText,
	tags,
	folder,
	reminderAt,
	existingFolders,
	notes,
	editingId,
	onTitleChange,
	onContentChange,
	onTagsChange,
	onFolderChange,
	onReminderChange,
	onSubmit,
	onClose,
	isSaving,
}) {
	const [titleLoading, setTitleLoading] = useState(false)
	const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
	const toast = useToast()

	// Snapshots the fields worth confirming before discarding, captured fresh
	// every time the modal opens. This component stays mounted between opens
	// (isOpen only toggles what render() returns, see the early return below),
	// so without re-capturing on each open, editing a second note would
	// compare itself against the first note's stale baseline. A ref, not
	// state — it's read only from handleAttemptClose below (an event
	// handler), never during render, so updating it doesn't need to trigger
	// a re-render.
	const initialRef = useRef(null)
	useEffect(() => {
		if (isOpen) {
			initialRef.current = {title, contentHtml, tags, folder, reminderAt}
		}
		// Deliberately re-snapshotting only on open/close, not on every
		// keystroke that changes title/contentHtml/tags/folder/reminderAt.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isOpen])

	// Write 500 words, mis-click 4px outside the card, and it used to be gone
	// — onClose() ran unconditionally. Now discarding a form that actually
	// differs from what it opened with needs a confirm; an untouched or
	// already-blank form still closes instantly, same as before. The dirty
	// check reads initialRef.current here, inside the handler, rather than
	// during render — refs aren't meant to be read while rendering (see
	// initialRef's own comment above), only from effects or event handlers.
	// Defined above the isOpen early-return below since useModalA11y (a
	// hook, unlike this) needs to be called unconditionally on every render.
	const handleAttemptClose = () => {
		const initial = initialRef.current
		const isDirty = !!initial && (
			title !== initial.title ||
			contentHtml !== initial.contentHtml ||
			tags !== initial.tags ||
			folder !== initial.folder ||
			reminderAt !== initial.reminderAt
		)
		if (isDirty) {
			setShowDiscardConfirm(true)
		} else {
			onClose()
		}
	}

	const panelRef = useRef(null)
	// Escape goes through the same dirty-check gate as the backdrop/Cancel/X
	// — it's just another way to attempt to close, not a bypass of it.
	useModalA11y(isOpen, handleAttemptClose, panelRef)

	if (!isOpen) return null

	const handleConfirmDiscard = () => {
		setShowDiscardConfirm(false)
		onClose()
	}

	const addingFolder = folder === '' || !existingFolders.includes(folder)

	const handleFolderSelect = (e) => {
		if (e.target.value === '__new__') {
			onFolderChange('')
		} else {
			onFolderChange(e.target.value)
		}
	}

	const handleGenerateTitle = async () => {
		if (!bodyPlainText.trim() || titleLoading) return
		setTitleLoading(true)
		try {
			const response = await api.post('/notes/suggest-title', {body: bodyPlainText})
			onTitleChange(response.data.title)
		} catch {
			toast.error('Title generation failed. Try again.')
		} finally {
			setTitleLoading(false)
		}
	}

	return (
		<>
		<div
			className="fixed inset-0 bg-[#0a0b10]/60 backdrop-blur-[3px] flex items-center justify-center z-20 p-4 min-[381px]:p-6"
			onClick={(e) => { if (e.target === e.currentTarget) handleAttemptClose() }}
		>
			<div
				ref={panelRef}
				role="dialog"
				aria-modal="true"
				aria-label={isEditing ? 'Edit note' : 'New note'}
				tabIndex={-1}
				className="w-full max-w-[440px] bg-[linear-gradient(160deg,var(--color-panel-a),var(--color-panel-b))] border border-accent/35 rounded-[20px] p-4 min-[381px]:p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)] outline-none"
			>
				<div className="flex items-center justify-between mb-3.5">
					<h3 className="text-base font-bold">{isEditing ? 'Edit note' : 'New note'}</h3>
					<button
						onClick={handleAttemptClose}
						aria-label="Close"
						className="w-7 h-7 p-0 rounded-[8px] bg-ink/6 border-none text-ink/62 text-xs font-semibold cursor-pointer transition-[opacity,transform] duration-200 hover:bg-ink/10 hover:opacity-100 active:scale-[0.98]"
					>✕</button>
				</div>

				<form onSubmit={onSubmit} className="flex flex-col gap-3">
					<div className="relative flex items-center">
						<input
							type="text"
							placeholder="Title"
							value={title}
							onChange={(e) => onTitleChange(e.target.value)}
							autoFocus
							required
							maxLength={300}
							className="input-base w-full pr-10"
						/>
						<button
							type="button"
							onClick={handleGenerateTitle}
							disabled={!bodyPlainText.trim() || titleLoading}
							aria-label="Generate title with AI"
							title="Generate title with AI"
							className="absolute right-1.5 w-[26px] h-[26px] p-0 rounded-[7px] flex items-center justify-center bg-ink-deep/55 border border-ink/15 text-ink/62 cursor-pointer transition-[opacity,transform] duration-200 hover:bg-accent/22 hover:text-accent hover:opacity-100 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-ink-deep/55 disabled:hover:text-ink/62"
						>
							<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className={titleLoading ? 'animate-[spin_0.9s_linear_infinite]' : ''}><path d="M12 2l1.8 5.6L19 9.4l-5.2 1.9L12 17l-1.8-5.7L5 9.4l5.2-1.8L12 2Z" /></svg>
						</button>
					</div>
					<NoteEditor
						contentHtml={contentHtml}
						legacyBody={legacyBody}
						onChange={onContentChange}
						placeholder="Write something..."
						notes={notes}
						currentNoteId={editingId}
					/>

					<input
						type="text"
						placeholder="Tags, comma separated"
						value={tags}
						onChange={(e) => onTagsChange(e.target.value)}
						className="input-base"
					/>

					{addingFolder ? (
						<input
							type="text"
							placeholder="New folder name"
							value={folder}
							onChange={(e) => onFolderChange(e.target.value)}
							autoFocus
							className="input-base"
						/>
					) : (
						<select value={folder} onChange={handleFolderSelect} className="input-base">
							{existingFolders.map((f) => (
								<option key={f} value={f}>{f}</option>
							))}
							<option value="__new__">+ New folder</option>
						</select>
					)}

					<div className="flex flex-col gap-1.5">
						<label className="text-[12px] text-ink/50" htmlFor="note-reminder">Remind me</label>
						<div className="flex items-center gap-2">
							<input
								id="note-reminder"
								type="datetime-local"
								value={reminderAt}
								onChange={(e) => onReminderChange(e.target.value)}
								className="input-base flex-1"
							/>
							{reminderAt && (
								<button
									type="button"
									onClick={() => onReminderChange('')}
									aria-label="Clear reminder"
									title="Clear reminder"
									className="w-9 h-9 shrink-0 rounded-[10px] flex items-center justify-center bg-ink/6 border border-ink/12 text-ink/62 cursor-pointer transition-[opacity,transform] duration-200 hover:bg-ink/10 active:scale-[0.98]"
								>✕</button>
							)}
						</div>
					</div>

					<div className="flex gap-2.5 mt-1">
						<button
							type="button"
							onClick={handleAttemptClose}
							className="bg-ink/8 border border-ink/20 text-ink rounded-[10px] font-semibold cursor-pointer transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-[0.98] flex-1 p-[11px] text-[13.5px]"
						>Cancel</button>
						{/* Without the disabled state a second click before the POST
					    resolved created a second, identical note — the request is
					    slow enough on a poor connection that nothing on screen
					    changes in between. */}
					<button
						type="submit"
						disabled={isSaving}
						className="btn-primary flex-1 p-[11px] text-[13.5px] disabled:opacity-60 disabled:cursor-not-allowed"
					>{isSaving ? 'Saving…' : isEditing ? 'Save changes' : 'Add note'}</button>
					</div>
				</form>
			</div>
		</div>

		<ConfirmModal
			isOpen={showDiscardConfirm}
			title="Discard this note?"
			message="You have unsaved changes. Closing now will lose them."
			confirmLabel="Discard"
			onConfirm={handleConfirmDiscard}
			onCancel={() => setShowDiscardConfirm(false)}
		/>
		</>
	)
}

export default NoteFormModal
