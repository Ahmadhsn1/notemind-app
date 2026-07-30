import {useEffect, useState} from 'react'
import api from '../api/axios'
import {useToast} from '../context/ToastContext'
import {relativeTime} from '../utils/relativeTime'
import {folderColor} from '../utils/folderColor'
import ConfirmModal from './ConfirmModal'

// Content-moderation view — lists one user's notes so an admin can see what
// they've actually written and remove a specific bad note, without the
// blunt-instrument option of deleting the whole account (see Admin.jsx's
// "Delete" action for that).
function AdminNotesModal({userId, onClose, onNoteDeleted}) {
	const [data, setData] = useState(null)
	const [loading, setLoading] = useState(true)
	const [deleteTarget, setDeleteTarget] = useState(null)
	const [deleting, setDeleting] = useState(false)
	const toast = useToast()

	useEffect(() => {
		if (!userId) return
		let ignore = false
		;(async () => {
			try {
				const res = await api.get(`/admin/users/${userId}/notes`)
				if (!ignore) setData(res.data)
			} catch {
				if (!ignore) toast.error("Could not load this user's notes.")
			} finally {
				if (!ignore) setLoading(false)
			}
		})()
		return () => { ignore = true }
		// eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only fetch (this component remounts fresh per open — see Admin.jsx's `{notesUserId && <AdminNotesModal .../>}`), toast is stable
	}, [userId])

	if (!userId) return null

	const handleConfirmDelete = async () => {
		if (!deleteTarget) return
		setDeleting(true)
		try {
			await api.delete(`/admin/notes/${deleteTarget._id}`)
			setData((prev) => ({...prev, notes: prev.notes.filter((n) => n._id !== deleteTarget._id)}))
			toast.success(`"${deleteTarget.title}" was deleted.`)
			onNoteDeleted?.(userId)
		} catch (err) {
			toast.error(err.response?.data?.message || 'Could not delete note.')
		} finally {
			setDeleting(false)
			setDeleteTarget(null)
		}
	}

	return (
		<div
			className="fixed inset-0 bg-[#0a0b10]/60 backdrop-blur-[3px] flex items-center justify-center z-30 p-4 min-[381px]:p-6"
			onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
		>
			<div className="w-full max-w-[560px] max-h-[80vh] bg-[linear-gradient(160deg,var(--color-panel-a),var(--color-panel-b))] border border-accent/35 rounded-[20px] p-4 min-[381px]:p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)] flex flex-col gap-3.5">
				<div className="flex items-center justify-between gap-2">
					<h3 className="text-base font-bold">{loading ? 'Notes' : `${data.user.name}'s notes`}</h3>
					<button
						onClick={onClose}
						aria-label="Close"
						className="w-7 h-7 p-0 shrink-0 rounded-[8px] bg-ink/6 border-none text-ink/62 text-xs font-semibold cursor-pointer transition-[opacity,transform] duration-200 hover:bg-ink/10 hover:opacity-100 active:scale-[0.98]"
					>✕</button>
				</div>

				{loading ? (
					<div className="h-[120px] flex items-center justify-center text-ink/40 text-[13px]">Loading…</div>
				) : data.notes.length === 0 ? (
					<div className="h-[120px] flex items-center justify-center text-ink/40 text-[13px]">No notes yet.</div>
				) : (
					<div className="flex flex-col gap-1.5 overflow-y-auto">
						{data.notes.map((n) => (
							<div key={n._id} className="flex items-center gap-2.5 py-2.5 px-3 rounded-[10px] bg-ink/5 border border-ink/10">
								<span className="w-2 h-2 rounded-full shrink-0" style={{background: folderColor(n.folder)}} />
								<div className="min-w-0 flex-1">
									<div className="text-[13px] font-semibold truncate">{n.title}</div>
									<div className="text-[11px] text-ink/45">{n.folder} · updated {relativeTime(n.updatedAt)}</div>
								</div>
								<button
									onClick={() => setDeleteTarget(n)}
									className="shrink-0 py-1 px-2.5 rounded-[6px] text-[11px] font-semibold bg-danger/15 border border-danger/30 text-danger-light cursor-pointer transition-colors duration-150 hover:bg-danger/25"
								>Delete</button>
							</div>
						))}
					</div>
				)}
			</div>

			<ConfirmModal
				isOpen={!!deleteTarget}
				title="Delete this note?"
				message={deleteTarget ? `"${deleteTarget.title}" will be permanently deleted, including its version history and any flashcards generated from it.` : ''}
				confirmLabel={deleting ? 'Deleting…' : 'Delete forever'}
				onConfirm={handleConfirmDelete}
				onCancel={() => setDeleteTarget(null)}
			/>
		</div>
	)
}

export default AdminNotesModal
