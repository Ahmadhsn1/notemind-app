import {useState} from 'react'
import api from '../api/axios'
import {useToast} from '../context/ToastContext'
import ConfirmModal from './ConfirmModal'

const BULK_ACTIONS = [
	{key: 'suspend', label: 'Suspend', confirmLabel: 'Suspend', message: (n) => `Suspend ${n} account${n === 1 ? '' : 's'}?`},
	{key: 'unsuspend', label: 'Unsuspend', confirmLabel: 'Unsuspend', message: (n) => `Unsuspend ${n} account${n === 1 ? '' : 's'}?`},
	{key: 'role_admin', label: 'Promote to admin', confirmLabel: 'Promote', message: (n) => `Promote ${n} user${n === 1 ? '' : 's'} to admin?`},
	{key: 'role_user', label: 'Demote to user', confirmLabel: 'Demote', message: (n) => `Demote ${n} account${n === 1 ? '' : 's'} to a regular user?`},
	{key: 'delete', label: 'Delete', confirmLabel: 'Delete forever', message: (n) => `Permanently delete ${n} account${n === 1 ? '' : 's'} and all their notes, flashcards, and version history? This can't be undone.`, danger: true},
]

// Appears above the Users table once rows are selected — every action here
// hits the single POST /admin/users/bulk endpoint (server enforces the
// self-guard against the whole batch), one audit-log entry per bulk call.
function AdminBulkActionBar({selectedIds, users, onCleared, onApplied}) {
	const [pendingAction, setPendingAction] = useState(null)
	const [running, setRunning] = useState(false)
	const toast = useToast()

	if (selectedIds.length === 0) return null

	const handleConfirm = async () => {
		if (!pendingAction) return
		setRunning(true)
		try {
			const res = await api.post('/admin/users/bulk', {userIds: selectedIds, action: pendingAction.key})
			toast.success(`${res.data.affected} account${res.data.affected === 1 ? '' : 's'} updated.`)
			onApplied?.(pendingAction.key, selectedIds)
			onCleared()
		} catch (err) {
			toast.error(err.response?.data?.message || 'Bulk action failed.')
		} finally {
			setRunning(false)
			setPendingAction(null)
		}
	}

	const selectedUsers = users.filter((u) => selectedIds.includes(u._id))
	const names = selectedUsers.slice(0, 3).map((u) => u.name).join(', ')

	return (
		<div className="flex flex-wrap items-center gap-2 py-2.5 px-3.5 rounded-[12px] bg-accent/12 border border-accent/30">
			<span className="text-[12.5px] font-semibold text-ink/75">{selectedIds.length} selected</span>
			<div className="flex flex-wrap gap-1.5 ml-auto">
				{BULK_ACTIONS.map((a) => (
					<button
						key={a.key}
						onClick={() => setPendingAction(a)}
						className={`py-1 px-2.5 rounded-[6px] text-[11px] font-semibold cursor-pointer transition-colors duration-150 whitespace-nowrap ${
							a.danger ? 'bg-danger/15 border border-danger/30 text-danger-light hover:bg-danger/25' : 'bg-ink/8 border border-ink/15 text-ink/70 hover:text-ink'
						}`}
					>{a.label}</button>
				))}
				<button
					onClick={onCleared}
					className="py-1 px-2.5 rounded-[6px] text-[11px] font-semibold cursor-pointer text-ink/45 hover:text-ink/70"
				>Clear</button>
			</div>

			<ConfirmModal
				isOpen={!!pendingAction}
				title={pendingAction?.label || ''}
				message={pendingAction ? `${pendingAction.message(selectedIds.length)}${names ? ` (${names}${selectedIds.length > 3 ? ', …' : ''})` : ''}` : ''}
				confirmLabel={running ? 'Working…' : pendingAction?.confirmLabel}
				onConfirm={handleConfirm}
				onCancel={() => setPendingAction(null)}
			/>
		</div>
	)
}

export default AdminBulkActionBar
