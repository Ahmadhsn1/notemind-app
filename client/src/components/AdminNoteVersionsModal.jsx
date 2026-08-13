import {useEffect, useMemo, useRef, useState} from 'react'
import DOMPurify from 'dompurify'
import api from '../api/axios'
import useModalA11y from '../hooks/useModalA11y'
import {useToast} from '../context/ToastContext'
import {relativeTime} from '../utils/relativeTime'

// Read-only version history for the admin's note viewer — deliberately no
// restore action anywhere here (unlike the owner-facing NoteViewModal): admin
// can see a note's history but never rewrites a user's content.
function AdminNoteVersionsModal({noteId, noteTitle, onClose}) {
	const [versions, setVersions] = useState(null)
	const [expandedId, setExpandedId] = useState(null)
	const toast = useToast()

	useEffect(() => {
		if (!noteId) return
		let ignore = false
		;(async () => {
			try {
				const res = await api.get(`/admin/notes/${noteId}/versions`)
				if (!ignore) setVersions(res.data)
			} catch {
				if (!ignore) toast.error('Could not load version history.')
			}
		})()
		return () => { ignore = true }
		// eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only fetch, remounts fresh per open
	}, [noteId])

	// No isOpen prop — the parent only mounts this component while shown
	// (see AdminNoteDetailModal's own {showVersions && <...>}), so a
	// constant `true` makes useModalA11y's "run once per open" effect fire
	// on mount and clean up on unmount, the equivalent transition here.
	const panelRef = useRef(null)
	useModalA11y(true, onClose, panelRef)

	if (!noteId) return null

	return (
		<div
			className="fixed inset-0 bg-[#0a0b10]/70 backdrop-blur-[3px] flex items-center justify-center z-[40] p-4 min-[381px]:p-6"
			onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
		>
			<div
				ref={panelRef}
				role="dialog"
				aria-modal="true"
				aria-label={`Version history${noteTitle ? ` — ${noteTitle}` : ''}`}
				tabIndex={-1}
				className="w-full max-w-[520px] max-h-[80vh] bg-[linear-gradient(160deg,var(--color-panel-a),var(--color-panel-b))] border border-accent/35 rounded-[20px] p-4 min-[381px]:p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)] flex flex-col gap-3.5 outline-none"
			>
				<div className="flex items-center justify-between gap-2">
					<h3 className="text-base font-bold truncate">Version history{noteTitle ? ` — ${noteTitle}` : ''}</h3>
					<button
						onClick={onClose}
						aria-label="Close"
						className="w-7 h-7 p-0 shrink-0 rounded-[8px] bg-ink/6 border-none text-ink/62 text-xs font-semibold cursor-pointer transition-[opacity,transform] duration-200 hover:bg-ink/10 active:scale-[0.98]"
					>✕</button>
				</div>

				{versions === null ? (
					<div className="h-[100px] flex items-center justify-center text-ink/40 text-[13px]">Loading…</div>
				) : versions.length === 0 ? (
					<div className="h-[100px] flex items-center justify-center text-ink/40 text-[13px]">No earlier versions.</div>
				) : (
					<div className="flex flex-col gap-1.5 overflow-y-auto">
						{versions.map((v) => (
							<VersionRow key={v._id} version={v} expanded={expandedId === v._id} onToggle={() => setExpandedId((id) => (id === v._id ? null : v._id))} />
						))}
					</div>
				)}
			</div>
		</div>
	)
}

function VersionRow({version, expanded, onToggle}) {
	const safeHtml = useMemo(() => DOMPurify.sanitize(version.contentHtml || `<p>${version.body || ''}</p>`), [version])

	return (
		<div className="rounded-[10px] bg-ink/5 border border-ink/10 overflow-hidden">
			<button
				type="button"
				onClick={onToggle}
				className="w-full flex items-center justify-between gap-2 py-2.5 px-3 cursor-pointer text-left"
			>
				<span className="text-[12.5px] text-ink/70 truncate">{relativeTime(version.createdAt)} · {version.title}</span>
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 text-ink/40 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}><path d="M9 18l6-6-6-6" /></svg>
			</button>
			{expanded && (
				<div
					className="note-prose text-[12.5px] text-ink/60 px-3 pb-3 max-h-[220px] overflow-y-auto border-t border-ink/8 pt-2.5"
					dangerouslySetInnerHTML={{__html: safeHtml}}
				/>
			)}
		</div>
	)
}

export default AdminNoteVersionsModal
