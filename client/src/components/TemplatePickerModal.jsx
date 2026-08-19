import {useEffect, useRef, useState} from 'react'
import api from '../api/axios'
import {NOTE_TEMPLATES} from '../utils/noteTemplates'
import useModalA11y from '../hooks/useModalA11y'
import {useToast} from '../context/ToastContext'
import NoteEditor from './NoteEditor'
import ConfirmModal from './ConfirmModal'

const PLUS_PATH = <path d="M12 5v14M5 12h14" />
const PENCIL_PATH = <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>
const TRASH_PATH = <><path d="M3 6h18" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" /></>
const BACK_PATH = <path d="M15 18l-6-6 6-6" />

const BLANK_TEMPLATE = {id: null, name: '', title: '', contentHtml: ''}

// User-authored templates (server-backed, CRUD via /api/templates) shown
// alongside the fixed NOTE_TEMPLATES array (client-only, not editable —
// see that file's own comment). Two view modes in one modal rather than a
// separate "manage templates" page: 'pick' is the everyday "+ New note"
// flow, 'edit' is create/rename/rewrite for a custom template, reached only
// from inside this same dialog. Reuses NoteEditor for the template's own
// content — the exact same rich-text surface a note itself uses — with
// notes=[] so the [[wikilink]] picker has nothing to link to (a template is
// a reusable pattern, not tied to any specific note).
function TemplatePickerModal({isOpen, onSelect, onClose}) {
	const [mode, setMode] = useState('pick')
	const [customTemplates, setCustomTemplates] = useState([])
	const [loading, setLoading] = useState(false)
	const [editing, setEditing] = useState(BLANK_TEMPLATE)
	const [saving, setSaving] = useState(false)
	const [deleteTarget, setDeleteTarget] = useState(null)
	const panelRef = useRef(null)
	const toast = useToast()

	/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect -- fetch driven by the external isOpen prop, not derived local state; toast is stable from context */
	useEffect(() => {
		if (!isOpen) return
		setMode('pick')
		setLoading(true)
		api.get('/templates')
			.then((res) => setCustomTemplates(res.data))
			.catch(() => toast.error('Could not load your templates.'))
			.finally(() => setLoading(false))
	}, [isOpen])
	/* eslint-enable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */

	// Edit mode wants the wider editor a note itself gets; the pick list
	// reads better narrow. onClose (not handleClose) also gates on mode —
	// closing mid-edit should just back out to the picker, not close the
	// whole dialog, so Escape/backdrop stay useful without losing the "+ New
	// note" flow underneath.
	const handleRequestClose = () => {
		if (mode === 'edit') {
			setMode('pick')
		} else {
			onClose()
		}
	}
	useModalA11y(isOpen, handleRequestClose, panelRef)

	if (!isOpen) return null

	const startCreate = () => {
		setEditing(BLANK_TEMPLATE)
		setMode('edit')
	}

	const startEdit = (template) => {
		setEditing({id: template._id, name: template.name, title: template.title, contentHtml: template.contentHtml})
		setMode('edit')
	}

	const handleSave = async (e) => {
		e.preventDefault()
		if (saving || !editing.name.trim()) return
		setSaving(true)
		try {
			const payload = {name: editing.name.trim(), title: editing.title, contentHtml: editing.contentHtml}
			if (editing.id) {
				const res = await api.put(`/templates/${editing.id}`, payload)
				setCustomTemplates((prev) => prev.map((t) => (t._id === editing.id ? res.data : t)))
				toast.success('Template updated.')
			} else {
				const res = await api.post('/templates', payload)
				setCustomTemplates((prev) => [res.data, ...prev])
				toast.success('Template created.')
			}
			setMode('pick')
		} catch (err) {
			toast.error(err.response?.data?.message || 'Could not save template. Try again.')
		} finally {
			setSaving(false)
		}
	}

	const handleDelete = async () => {
		const target = deleteTarget
		try {
			await api.delete(`/templates/${target._id}`)
			setCustomTemplates((prev) => prev.filter((t) => t._id !== target._id))
			toast.success('Template deleted.')
		} catch {
			toast.error('Could not delete template. Try again.')
		} finally {
			setDeleteTarget(null)
		}
	}

	const isEditingExisting = !!editing.id

	return (
		<>
		<div
			className="fixed inset-0 bg-[#0a0b10]/60 backdrop-blur-[3px] flex items-center justify-center z-20 p-4 min-[381px]:p-6"
			onClick={(e) => { if (e.target === e.currentTarget) handleRequestClose() }}
		>
			<div
				ref={panelRef}
				role="dialog"
				aria-modal="true"
				aria-label={mode === 'edit' ? (isEditingExisting ? 'Edit template' : 'New template') : 'New note'}
				tabIndex={-1}
				className={`w-full bg-[linear-gradient(160deg,var(--color-panel-a),var(--color-panel-b))] border border-accent/35 rounded-[20px] p-4 min-[381px]:p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)] outline-none transition-[max-width] ${mode === 'edit' ? 'max-w-[600px]' : 'max-w-[460px]'}`}
			>
				{mode === 'pick' ? (
					<>
						<div className="flex items-center justify-between mb-3.5">
							<h3 className="text-base font-bold">New note</h3>
							<button
								onClick={onClose}
								aria-label="Close"
								className="w-7 h-7 p-0 rounded-[8px] bg-ink/6 border-none text-ink/62 text-xs font-semibold cursor-pointer transition-[opacity,transform] duration-200 hover:bg-ink/10 hover:opacity-100 active:scale-[0.98]"
							>✕</button>
						</div>

						<p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink/40 mb-2">Quick start</p>
						<div className="flex flex-col gap-2 mb-5">
							{NOTE_TEMPLATES.map((template) => (
								<button
									key={template.key}
									type="button"
									onClick={() => onSelect(template)}
									className="text-left p-3 rounded-[12px] bg-ink/6 border border-ink/12 cursor-pointer transition-[opacity,transform,background-color] duration-200 hover:bg-accent/15 hover:border-accent/35 active:scale-[0.99]"
								>
									<div className="text-[13.5px] font-semibold">{template.label}</div>
									<div className="text-[12px] text-ink/55 mt-0.5">{template.description}</div>
								</button>
							))}
						</div>

						<div className="flex items-center justify-between mb-2">
							<p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink/40">Your templates</p>
							<button
								type="button"
								onClick={startCreate}
								className="flex items-center gap-1 text-[11.5px] font-semibold text-accent cursor-pointer transition-opacity duration-200 hover:opacity-80"
							>
								<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">{PLUS_PATH}</svg>
								New template
							</button>
						</div>

						{loading ? (
							<p className="text-[12.5px] text-ink/45 py-3 text-center">Loading…</p>
						) : customTemplates.length === 0 ? (
							<p className="text-[12.5px] text-ink/45 py-3 text-center leading-relaxed">No custom templates yet. Save any note as one, or start from scratch.</p>
						) : (
							<div className="flex flex-col gap-2 max-h-[240px] overflow-y-auto pr-0.5">
								{customTemplates.map((template) => (
									<div
										key={template._id}
										className="group flex items-center gap-1.5 p-1.5 pl-3 rounded-[12px] bg-ink/6 border border-ink/12 transition-colors duration-200 hover:bg-accent/10 hover:border-accent/30"
									>
										<button
											type="button"
											onClick={() => onSelect(template)}
											className="flex-1 min-w-0 text-left cursor-pointer py-1.5"
										>
											<div className="text-[13.5px] font-semibold truncate">{template.name}</div>
											{template.title && <div className="text-[12px] text-ink/50 truncate mt-0.5">{template.title}</div>}
										</button>
										<button
											type="button"
											onClick={() => startEdit(template)}
											aria-label={`Edit ${template.name}`}
											title="Edit template"
											className="w-7 h-7 shrink-0 rounded-[7px] flex items-center justify-center bg-transparent border border-transparent text-ink/45 cursor-pointer transition-colors duration-150 hover:bg-ink/10 hover:text-ink"
										>
											<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{PENCIL_PATH}</svg>
										</button>
										<button
											type="button"
											onClick={() => setDeleteTarget(template)}
											aria-label={`Delete ${template.name}`}
											title="Delete template"
											className="w-7 h-7 shrink-0 rounded-[7px] flex items-center justify-center bg-transparent border border-transparent text-ink/45 cursor-pointer transition-colors duration-150 hover:bg-danger/18 hover:text-danger-light"
										>
											<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{TRASH_PATH}</svg>
										</button>
									</div>
								))}
							</div>
						)}
					</>
				) : (
					<form onSubmit={handleSave} className="flex flex-col gap-3.5">
						<div className="flex items-center justify-between mb-0.5">
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={() => setMode('pick')}
									aria-label="Back"
									className="w-7 h-7 p-0 rounded-[8px] bg-ink/6 border-none text-ink/62 cursor-pointer transition-[opacity,transform] duration-200 hover:bg-ink/10 active:scale-[0.98] flex items-center justify-center"
								>
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{BACK_PATH}</svg>
								</button>
								<h3 className="text-[15px] font-bold">{isEditingExisting ? 'Edit template' : 'New template'}</h3>
							</div>
							<button
								type="button"
								onClick={onClose}
								aria-label="Close"
								className="w-7 h-7 p-0 rounded-[8px] bg-ink/6 border-none text-ink/62 text-xs font-semibold cursor-pointer transition-[opacity,transform] duration-200 hover:bg-ink/10 hover:opacity-100 active:scale-[0.98]"
							>✕</button>
						</div>

						<input
							type="text"
							placeholder="Template name (e.g. Sprint retro)"
							value={editing.name}
							onChange={(e) => setEditing((prev) => ({...prev, name: e.target.value}))}
							autoFocus
							required
							maxLength={80}
							className="input-base w-full font-semibold"
						/>
						<input
							type="text"
							placeholder="Default title (optional)"
							value={editing.title}
							onChange={(e) => setEditing((prev) => ({...prev, title: e.target.value}))}
							maxLength={300}
							className="input-base w-full"
						/>
						<NoteEditor
							contentHtml={editing.contentHtml}
							legacyBody=""
							onChange={({html}) => setEditing((prev) => ({...prev, contentHtml: html}))}
							placeholder="What should this template start with?"
							notes={[]}
							currentNoteId={null}
						/>

						<div className="flex gap-2.5 mt-1">
							{isEditingExisting && (
								<button
									type="button"
									onClick={() => setDeleteTarget(customTemplates.find((t) => t._id === editing.id))}
									aria-label="Delete template"
									title="Delete template"
									className="w-11 shrink-0 rounded-[10px] flex items-center justify-center bg-danger/12 border border-danger/30 text-danger-light cursor-pointer transition-[opacity,transform] duration-200 hover:bg-danger/20 active:scale-[0.98]"
								>
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{TRASH_PATH}</svg>
								</button>
							)}
							<button
								type="button"
								onClick={() => setMode('pick')}
								className="bg-ink/8 border border-ink/20 text-ink rounded-[10px] font-semibold cursor-pointer transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-[0.98] flex-1 p-[11px] text-[13.5px]"
							>Cancel</button>
							<button
								type="submit"
								disabled={saving || !editing.name.trim()}
								className="btn-primary flex-1 p-[11px] text-[13.5px] disabled:opacity-60 disabled:cursor-not-allowed"
							>{saving ? 'Saving…' : isEditingExisting ? 'Save template' : 'Create template'}</button>
						</div>
					</form>
				)}
			</div>
		</div>

		<ConfirmModal
			isOpen={!!deleteTarget}
			title="Delete this template?"
			message={deleteTarget ? `"${deleteTarget.name}" will be gone for good — this can't be undone.` : ''}
			confirmLabel="Delete"
			onConfirm={async () => {
				await handleDelete()
				if (mode === 'edit') setMode('pick')
			}}
			onCancel={() => setDeleteTarget(null)}
		/>
		</>
	)
}

export default TemplatePickerModal
