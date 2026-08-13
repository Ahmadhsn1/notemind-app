import { useRef, useState } from 'react'
import api, { getAuthToken } from '../api/axios'
import { useToast } from '../context/ToastContext'
import ConfirmModal from './ConfirmModal'
import useModalA11y from '../hooks/useModalA11y'

// The old version of this modal faked a "typing" reveal over an answer that
// had already fully arrived — POST /api/notes/ask now genuinely streams, so
// the real incremental `answer` state updates below (see handleSubmit) ARE
// the typing effect; no need to fake one on top of real streamed text.
const CLIENT_META_DELIMITER = '\n<<<NOTEMIND_META>>>\n'

// Builds a human-readable confirm prompt + does the actual execution for a
// suggestedAction. Execution deliberately reuses the existing note CRUD
// endpoints (PUT/POST/DELETE) instead of adding new backend routes — every
// action Momo can suggest is just a specific, pre-filled call to something
// the app already does.
const describeAction = (action, notes) => {
	const findTitle = (id) => notes.find((n) => n._id === id)?.title || 'a note'

	if (action.type === 'add_tags') {
		return {
			label: `Add tags to "${findTitle(action.payload.noteId)}"`,
			detail: action.payload.tags.join(', '),
			confirmMessage: `Add tags [${action.payload.tags.join(', ')}] to "${findTitle(action.payload.noteId)}"?`,
		}
	}
	if (action.type === 'merge_notes') {
		const [keepId, mergeId] = action.payload.noteIds
		return {
			label: `Merge "${findTitle(mergeId)}" into "${findTitle(keepId)}"`,
			detail: action.payload.reason,
			confirmMessage: `Merge "${findTitle(mergeId)}" into "${findTitle(keepId)}"? The merged content will be appended to "${findTitle(keepId)}" and "${findTitle(mergeId)}" will be moved to Trash.`,
		}
	}
	return {
		label: `Create note "${action.payload.title}"`,
		detail: action.payload.body,
		confirmMessage: `Create a new note titled "${action.payload.title}"?`,
	}
}

const executeAction = async (action, notes) => {
	if (action.type === 'add_tags') {
		const note = notes.find((n) => n._id === action.payload.noteId)
		const mergedTags = Array.from(new Set([...(note?.tags || []), ...action.payload.tags]))
		await api.put(`/notes/${action.payload.noteId}`, { tags: mergedTags })
		return
	}
	if (action.type === 'merge_notes') {
		const [keepId, mergeId] = action.payload.noteIds
		const keepNote = notes.find((n) => n._id === keepId)
		const mergeNote = notes.find((n) => n._id === mergeId)
		const mergedTags = Array.from(new Set([...(keepNote?.tags || []), ...(mergeNote?.tags || [])]))
		const mergedHtml = `${keepNote?.contentHtml || ''}<p><br></p><blockquote><p>Merged from "${mergeNote?.title || ''}"</p></blockquote>${mergeNote?.contentHtml || ''}`
		await api.put(`/notes/${keepId}`, { contentHtml: mergedHtml, tags: mergedTags })
		await api.delete(`/notes/${mergeId}`)
		return
	}
	await api.post('/notes', { title: action.payload.title, body: action.payload.body })
}

function AskAIModal({isOpen, onClose, notes, onActionApplied}) {
	const toast = useToast()
	const [question, setQuestion] = useState('')
	const [answer, setAnswer] = useState(null)
	const [sources, setSources] = useState([])
	const [actions, setActions] = useState([])
	const [appliedTypes, setAppliedTypes] = useState({})
	const [confirmingAction, setConfirmingAction] = useState(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState('')
	// Dashboard keeps this component mounted at all times (isOpen only hides
	// its output), so a request left running when the user closes the modal
	// would otherwise keep going in the background forever — silently
	// leaving `loading` stuck true and blocking the next question the next
	// time the modal opens. Aborting it here is what actually stops that.
	const abortRef = useRef(null)

	const reset = () => {
		abortRef.current?.abort()
		setQuestion('')
		setAnswer(null)
		setSources([])
		setActions([])
		setAppliedTypes({})
		setConfirmingAction(null)
		setLoading(false)
		setError('')
	}

	const handleClose = () => {
		reset()
		onClose()
	}

	// Defined above the isOpen early-return below since useModalA11y (a hook,
	// unlike handleClose above it) needs to be called unconditionally on
	// every render.
	const panelRef = useRef(null)
	useModalA11y(isOpen, handleClose, panelRef)

	if (!isOpen) return null

	// Uses raw fetch rather than the axios instance — axios doesn't expose an
	// incremental read of the response body in the browser the way
	// `response.body.getReader()` does, and streaming the answer as it
	// arrives (instead of waiting for the full reply) is the whole point
	// here. Auth header is attached by hand to match what the axios
	// interceptor does for every other request.
	const handleSubmit = async (e) => {
		e.preventDefault()
		if (!question.trim() || loading) return

		setLoading(true)
		setError('')
		setAnswer(null)
		setSources([])
		setActions([])
		setAppliedTypes({})
		const controller = new AbortController()
		abortRef.current = controller
		try {
			const token = getAuthToken()
			const baseURL = api.defaults.baseURL
			const res = await fetch(`${baseURL}/notes/ask`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...(token ? {Authorization: `Bearer ${token}`} : {}),
				},
				body: JSON.stringify({question}),
				signal: controller.signal,
			})

			if (!res.ok) {
				const data = await res.json().catch(() => ({}))
				throw new Error(data.message || 'Something went wrong, try again.')
			}

			const reader = res.body.getReader()
			const decoder = new TextDecoder()
			let full = ''
			setAnswer('')

			while (true) {
				const {done, value} = await reader.read()
				if (done) break
				full += decoder.decode(value, {stream: true})
				const delimIndex = full.indexOf(CLIENT_META_DELIMITER)
				setAnswer(delimIndex === -1 ? full : full.slice(0, delimIndex))
			}

			const delimIndex = full.indexOf(CLIENT_META_DELIMITER)
			if (delimIndex !== -1) {
				try {
					const meta = JSON.parse(full.slice(delimIndex + CLIENT_META_DELIMITER.length))
					setSources(meta.sources || [])
					setActions(meta.suggestedActions || [])
				} catch {
					// Metadata didn't parse — answer text is already shown either way.
				}
			}
		} catch (err) {
			// AbortError means the user closed the modal mid-request (see
			// reset() above) — reset() already cleared loading/error for a
			// closed, no-longer-visible modal, so there's nothing to show.
			if (err.name !== 'AbortError') {
				setError(err.message || 'Something went wrong, try again.')
			}
		} finally {
			if (abortRef.current === controller) {
				setLoading(false)
				abortRef.current = null
			}
		}
	}

	const handleApply = async () => {
		if (!confirmingAction) return
		const {action, index} = confirmingAction
		setConfirmingAction(null)
		try {
			await executeAction(action, notes)
			setAppliedTypes((prev) => ({...prev, [index]: true}))
			onActionApplied?.()
			toast.success('Done.')
		} catch {
			toast.error('Could not apply that action. Try again.')
		}
	}

	return (
		<div
			className="fixed inset-0 bg-[#0a0b10]/60 backdrop-blur-[3px] flex items-center justify-center z-20 p-4 min-[381px]:p-6"
			onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
		>
			<div
				ref={panelRef}
				role="dialog"
				aria-modal="true"
				aria-label="Ask your notes"
				tabIndex={-1}
				className="w-full max-w-[480px] bg-[linear-gradient(160deg,var(--color-panel-a),var(--color-panel-b))] border border-accent/35 rounded-[20px] p-4 min-[381px]:p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)] outline-none"
			>
				<div className="flex items-center justify-between mb-3.5">
					<h3 className="text-base font-bold flex items-center gap-2">
						<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="text-accent"><path d="M12 2l1.8 5.6L19 9.4l-5.2 1.9L12 17l-1.8-5.7L5 9.4l5.2-1.8L12 2Z" /></svg>
						Ask Momo
					</h3>
					<button
						onClick={handleClose}
						aria-label="Close"
						className="w-7 h-7 p-0 rounded-[8px] bg-ink/6 border-none text-ink/62 text-xs font-semibold cursor-pointer transition-[opacity,transform] duration-200 hover:bg-ink/10 hover:opacity-100 active:scale-[0.98]"
					>✕</button>
				</div>

				{!answer && !loading && (
					<p className="text-[12.5px] text-ink/50 mb-3 -mt-1">Hi, I'm Momo — ask me anything about your notes, or ask me to tag, merge, or draft one for you.</p>
				)}

				<form onSubmit={handleSubmit} className="flex flex-col gap-3">
					{/* Matches MAX_QUESTION_LENGTH in server/validators/noteValidators.js
					    — the server rejects anything longer, so stopping it here
					    turns a 400 into a no-op keystroke. */}
					<textarea
						placeholder="Ask Momo about your notes..."
						rows={2}
						maxLength={2000}
						value={question}
						onChange={(e) => setQuestion(e.target.value)}
						autoFocus
						className="input-base resize-none"
					/>

					<button type="submit" disabled={loading || !question.trim()} className="btn-primary p-[11px] text-[13.5px] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
						{loading && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-[spin_0.9s_linear_infinite]"><path d="M21 12a9 9 0 1 1-9-9" strokeLinecap="round" /></svg>}
						{loading ? 'Momo is thinking...' : 'Ask'}
					</button>

					{error && <p className="text-danger-light text-sm text-center">{error}</p>}

					{answer && (
						<div className="bg-gradient-to-br from-accent/12 to-growth/10 border border-accent/25 rounded-[10px] py-2.5 px-3 flex flex-col gap-2">
							<p className="text-[13px] text-ink/85 leading-[1.55]">{answer}</p>
							{sources.length > 0 && (
								<div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-ink/10">
									<span className="text-[10.5px] font-semibold text-ink/40 uppercase tracking-[0.04em]">Based on</span>
									{sources.map((s) => (
										<span key={s._id} className="bg-accent/30 text-accent text-[11px] py-[3px] px-2.5 rounded-full">{s.title}</span>
									))}
								</div>
							)}
						</div>
					)}

					{actions.length > 0 && (
						<div className="flex flex-col gap-2">
							<span className="text-[10.5px] font-semibold text-ink/40 uppercase tracking-[0.04em]">Suggested actions</span>
							{actions.map((action, index) => {
								const {label, detail} = describeAction(action, notes)
								const applied = !!appliedTypes[index]
								return (
									<div key={index} className="bg-ink/5 border border-ink/12 rounded-[10px] py-2.5 px-3 flex items-center justify-between gap-3">
										<div className="min-w-0">
											<p className="text-[12.5px] font-semibold text-ink/85 truncate">{label}</p>
											{detail && <p className="text-[11.5px] text-ink/50 truncate">{detail}</p>}
										</div>
										{applied ? (
											<span className="text-[11.5px] font-semibold text-growth shrink-0">Applied</span>
										) : (
											<button
												type="button"
												onClick={() => setConfirmingAction({action, index})}
												className="shrink-0 py-[7px] px-3 text-[12px] font-semibold rounded-[8px] bg-accent/20 border border-accent/35 text-accent cursor-pointer transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-[0.98]"
											>Apply</button>
										)}
									</div>
								)
							})}
						</div>
					)}
				</form>
			</div>

			<ConfirmModal
				isOpen={!!confirmingAction}
				title="Apply this action?"
				message={confirmingAction ? describeAction(confirmingAction.action, notes).confirmMessage : ''}
				confirmLabel="Apply"
				onConfirm={handleApply}
				onCancel={() => setConfirmingAction(null)}
			/>
		</div>
	)
}

export default AskAIModal
