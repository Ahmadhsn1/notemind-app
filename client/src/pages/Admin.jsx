import {useEffect, useRef, useState} from 'react'
import {Link} from 'react-router-dom'
import {io} from 'socket.io-client'
import api, {API_ORIGIN, getAuthToken} from '../api/axios'
import {useAuth} from '../context/AuthContext'
import {useToast} from '../context/ToastContext'
import {relativeTime, activityStatus} from '../utils/relativeTime'
import ConfirmModal from '../components/ConfirmModal'
import AdminUserContentModal from '../components/AdminUserContentModal'
import AdminPasswordResetModal from '../components/AdminPasswordResetModal'
import SendNotificationModal from '../components/SendNotificationModal'
import AdminBulkActionBar from '../components/AdminBulkActionBar'
import AdminSystemPanel from '../components/AdminSystemPanel'

function StatTile({label, value}) {
	return (
		<div className="rounded-[14px] border border-ink/12 bg-ink/4 p-4 flex flex-col gap-1">
			<span className="text-[26px] font-extrabold tracking-[-0.02em] tabular-nums">{value}</span>
			<span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-ink/45">{label}</span>
		</div>
	)
}

// Single-hue bar chart — two of these (signups, notes created) rather than
// one dual-axis combo chart, since they're different-scale measures (see
// dataviz "one axis" rule). Same visual pattern as Dashboard's
// MomentumHero "Daily activity" chart, just 30 points instead of 7.
function GrowthChart({label, data, dataKey, color, total}) {
	const max = Math.max(1, ...data.map((d) => d[dataKey]))
	return (
		<div className="rounded-[14px] border border-ink/12 bg-ink/4 p-4">
			<div className="flex items-baseline justify-between mb-3">
				<span className="text-[11px] font-bold uppercase tracking-[0.05em] text-ink/45">{label}</span>
				<span className="text-[13px] font-bold tabular-nums">{total} <span className="text-ink/40 font-normal">/ 30d</span></span>
			</div>
			<div className="flex items-end gap-[3px] h-[60px]">
				{data.map((d) => (
					<div key={d.date} className="flex-1 h-full flex items-end" title={`${d.date}: ${d[dataKey]}`}>
						<div
							className="w-full rounded-t-[2px] transition-[height] duration-300"
							style={{height: `${Math.max(d[dataKey] > 0 ? 8 : 3, (d[dataKey] / max) * 100)}%`, background: color, opacity: d[dataKey] > 0 ? 1 : 0.25}}
						/>
					</div>
				))}
			</div>
		</div>
	)
}

const ACTION_VERBS = {
	promote: 'promoted',
	demote: 'demoted',
	suspend: 'suspended',
	unsuspend: 'unsuspended',
	delete_user: 'deleted',
	reset_password: 'reset the password for',
	delete_note: 'deleted note',
	send_notification: 'sent a notification to',
	delete_notification: 'deleted a notification sent to',
	archive_note: 'archived note',
	unarchive_note: 'unarchived note',
	trash_note: 'trashed note',
	restore_note: 'restored note',
	permanently_delete_note: 'permanently deleted note',
	unpin_note: 'unpinned note',
	delete_flashcard: 'deleted a flashcard from',
	export_user_data: 'exported data for',
	bulk_suspend: 'bulk-suspended',
	bulk_unsuspend: 'bulk-unsuspended',
	bulk_delete_user: 'bulk-deleted',
	bulk_role_change: 'bulk-changed role for',
}

// Groups audit actions into the filter dropdown's categories — client-side
// only (100 entries is small enough to filter in-browser, no new endpoint).
const ACTION_CATEGORY = {
	promote: 'users', demote: 'users', suspend: 'users', unsuspend: 'users', delete_user: 'users', reset_password: 'users',
	bulk_suspend: 'users', bulk_unsuspend: 'users', bulk_delete_user: 'users', bulk_role_change: 'users',
	delete_note: 'notes', archive_note: 'notes', unarchive_note: 'notes', trash_note: 'notes', restore_note: 'notes',
	permanently_delete_note: 'notes', unpin_note: 'notes',
	delete_flashcard: 'flashcards',
	send_notification: 'notifications', delete_notification: 'notifications',
	export_user_data: 'data',
}
const AUDIT_CATEGORIES = [['all', 'All'], ['users', 'Users'], ['notes', 'Notes'], ['flashcards', 'Flashcards'], ['notifications', 'Notifications'], ['data', 'Data']]

const TABS = [
	['overview', 'Overview'],
	['users', 'Users'],
	['content', 'Content'],
	['notifications', 'Notifications'],
	['audit', 'Audit log'],
	['system', 'System'],
]

const actionBtnClass = 'py-1 px-2 rounded-[6px] text-[11px] font-semibold cursor-pointer transition-[opacity,transform] duration-150 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap'

// Expandable to a per-recipient read breakdown rather than a separate
// popup — the row itself just toggles, matching how the rest of this page
// (audit log, users table) already keeps everything inline.
function NotificationRow({notification, expanded, onToggleExpand, onDelete}) {
	return (
		<div className="text-[12.5px]">
			<div className="flex items-center justify-between gap-3 py-2.5 px-3.5">
				<button type="button" onClick={onToggleExpand} className="flex-1 min-w-0 text-left cursor-pointer">
					<p className="text-ink/85 truncate">{notification.message}</p>
					<span className="text-ink/40 text-[11px]">
						{notification.readCount}/{notification.totalRecipients} read · {relativeTime(notification.createdAt)}
						{notification.createdBy ? ` · sent by ${notification.createdBy.name}` : ''}
					</span>
				</button>
				<button
					onClick={onDelete}
					className="py-1 px-2 rounded-[6px] text-[11px] font-semibold bg-danger/15 border border-danger/30 text-danger-light hover:bg-danger/25 cursor-pointer shrink-0"
				>Delete</button>
			</div>
			{expanded && (
				<div className="px-3.5 pb-2.5 flex flex-wrap gap-1.5">
					{notification.recipients.map((r) => (
						<span key={r._id} className={`text-[11px] py-[3px] px-2 rounded-full ${r.read ? 'bg-growth/15 text-growth' : 'bg-ink/8 text-ink/50'}`}>
							{r.name}
						</span>
					))}
				</div>
			)}
		</div>
	)
}

function Admin() {
	const {user: currentUser} = useAuth()
	const [activeTab, setActiveTab] = useState('overview')
	const [stats, setStats] = useState(null)
	const [users, setUsers] = useState(null)
	const [growth, setGrowth] = useState(null)
	const [auditLog, setAuditLog] = useState(null)
	const [auditFilter, setAuditFilter] = useState('all')
	const [notifications, setNotifications] = useState(null)
	const [system, setSystem] = useState(null)
	const [showSendModal, setShowSendModal] = useState(false)
	const [expandedNotifId, setExpandedNotifId] = useState(null)
	const [loading, setLoading] = useState(true)
	const [live, setLive] = useState(false)
	const [actingOnId, setActingOnId] = useState(null)
	const [deleteTarget, setDeleteTarget] = useState(null)
	const [contentUserId, setContentUserId] = useState(null)
	const [passwordResetResult, setPasswordResetResult] = useState(null)
	const [selectedIds, setSelectedIds] = useState([])
	const [exportOpenId, setExportOpenId] = useState(null)
	const [exportingKey, setExportingKey] = useState(null)
	const toast = useToast()
	const mountedRef = useRef(true)
	const activeTabRef = useRef(activeTab)
	useEffect(() => {
		activeTabRef.current = activeTab
	})

	// Ticks the "Last active" column live (Active / less than a min / X min)
	// instead of it being frozen at whatever moment the table last rendered
	// for some other reason (a socket-triggered refetch, a manual action) —
	// activityStatus() takes `now` as an argument specifically so re-invoking
	// it here on every tick actually changes its output.
	const [now, setNow] = useState(() => Date.now())
	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), 1000)
		return () => clearInterval(id)
	}, [])

	// Shared by the initial mount fetch and the socket-triggered refresh below
	// — `silent` skips the error toast for background refreshes (a transient
	// failure there shouldn't interrupt an admin mid-read the way a failed
	// initial load should) and never needs to re-arm the loading spinner,
	// since `loading` already starts `true` and only this function ever turns
	// it off. System status is only fetched when that tab is active — no
	// point polling operational data nobody's looking at on every mutation
	// elsewhere in the app.
	const loadAdminData = async (silent = false) => {
		try {
			const calls = [
				api.get('/admin/stats'),
				api.get('/admin/users'),
				api.get('/admin/growth'),
				api.get('/admin/audit-log'),
				api.get('/admin/notifications'),
			]
			const includeSystem = activeTabRef.current === 'system'
			if (includeSystem) calls.push(api.get('/admin/system'))

			const results = await Promise.all(calls)
			if (!mountedRef.current) return
			setStats(results[0].data)
			setUsers(results[1].data)
			setGrowth(results[2].data)
			setAuditLog(results[3].data)
			setNotifications(results[4].data)
			if (includeSystem) setSystem(results[5].data)
		} catch {
			if (mountedRef.current && !silent) toast.error('Could not load admin data.')
		} finally {
			if (mountedRef.current && !silent) setLoading(false)
		}
	}

	/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect -- loadAdminData is re-created each render by design; this is a mount-only fetch, matches Dashboard's own pattern */
	useEffect(() => {
		mountedRef.current = true
		loadAdminData()
		return () => { mountedRef.current = false }
	}, [])
	/* eslint-enable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */

	// Fetch System data the first time that tab is opened (loadAdminData only
	// includes it on subsequent refreshes once activeTabRef already points at
	// 'system').
	useEffect(() => {
		if (activeTab === 'system' && system === null) {
			api.get('/admin/system').then((res) => { if (mountedRef.current) setSystem(res.data) }).catch(() => {
				if (mountedRef.current) toast.error('Could not load system status.')
			})
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- toast is stable, system checked via closure is intentional (only fetch once)
	}, [activeTab])

	// Server pushes a bare "something changed" signal (see
	// server/services/socket.js's broadcastAdminUpdate) whenever any
	// admin-visible data mutates anywhere in the app — a note created, a user
	// signing up, another admin's action, etc. Reacting to it by silently
	// refetching the same REST endpoints the initial load used (rather than
	// trying to keep a second, parallel copy of every aggregation's logic in
	// sync via socket payloads) means the numbers shown are always exactly
	// what a manual reload would produce. Debounced so a burst of
	// near-simultaneous mutations triggers one refetch, not one per event.
	useEffect(() => {
		const token = getAuthToken()
		if (!token) return

		const socket = io(API_ORIGIN, {auth: {token}})
		let debounceTimer = null

		socket.on('connect', () => setLive(true))
		socket.on('disconnect', () => setLive(false))
		socket.on('admin:update', () => {
			clearTimeout(debounceTimer)
			debounceTimer = setTimeout(() => loadAdminData(true), 400)
		})

		return () => {
			clearTimeout(debounceTimer)
			socket.disconnect()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only connection, matches the fetch effect above
	}, [])

	const patchUser = (id, fields) => {
		setUsers((prev) => prev.map((u) => (u._id === id ? {...u, ...fields} : u)))
	}

	const refreshAuditLog = async () => {
		try {
			const res = await api.get('/admin/audit-log')
			setAuditLog(res.data)
		} catch {
			// Non-critical — the action itself already succeeded and showed its
			// own toast; a stale log list until next reload isn't worth erroring over.
		}
	}

	const handleToggleRole = async (u) => {
		const nextRole = u.role === 'admin' ? 'user' : 'admin'
		setActingOnId(u._id)
		try {
			await api.patch(`/admin/users/${u._id}/role`, {role: nextRole})
			patchUser(u._id, {role: nextRole})
			toast.success(nextRole === 'admin' ? `${u.name} is now an admin.` : `${u.name} is no longer an admin.`)
			refreshAuditLog()
		} catch (err) {
			toast.error(err.response?.data?.message || 'Could not update role.')
		} finally {
			setActingOnId(null)
		}
	}

	const handleToggleSuspend = async (u) => {
		const nextSuspended = !u.suspended
		setActingOnId(u._id)
		try {
			await api.patch(`/admin/users/${u._id}/suspend`, {suspended: nextSuspended})
			patchUser(u._id, {suspended: nextSuspended})
			toast.success(nextSuspended ? `${u.name} has been suspended.` : `${u.name} has been unsuspended.`)
			refreshAuditLog()
		} catch (err) {
			toast.error(err.response?.data?.message || 'Could not update suspension.')
		} finally {
			setActingOnId(null)
		}
	}

	const handleResetPassword = async (u) => {
		setActingOnId(u._id)
		try {
			const res = await api.post(`/admin/users/${u._id}/reset-password`)
			setPasswordResetResult({name: u.name, tempPassword: res.data.tempPassword})
			refreshAuditLog()
		} catch (err) {
			toast.error(err.response?.data?.message || 'Could not reset password.')
		} finally {
			setActingOnId(null)
		}
	}

	const handleConfirmDelete = async () => {
		if (!deleteTarget) return
		setActingOnId(deleteTarget._id)
		try {
			await api.delete(`/admin/users/${deleteTarget._id}`)
			setUsers((prev) => prev.filter((u) => u._id !== deleteTarget._id))
			setStats((prev) => (prev ? {...prev, totalUsers: prev.totalUsers - 1} : prev))
			toast.success(`${deleteTarget.name}'s account was deleted.`)
			refreshAuditLog()
		} catch (err) {
			toast.error(err.response?.data?.message || 'Could not delete user.')
		} finally {
			setActingOnId(null)
			setDeleteTarget(null)
		}
	}

	const handleDeleteNotification = async (id) => {
		try {
			await api.delete(`/admin/notifications/${id}`)
			setNotifications((prev) => prev.filter((n) => n._id !== id))
			refreshAuditLog()
		} catch (err) {
			toast.error(err.response?.data?.message || 'Could not delete notification.')
		}
	}

	// Called from AdminUserContentModal after a note lifecycle action —
	// `opts.removed` only true for the permanent-delete path, since that's
	// the only one that actually changes the note count.
	const handleContentChanged = (userId, opts) => {
		if (opts?.removed) {
			setUsers((prev) => prev.map((u) => (u._id === userId ? {...u, noteCount: Math.max(0, u.noteCount - 1)} : u)))
			setStats((prev) => (prev ? {...prev, totalNotes: Math.max(0, prev.totalNotes - 1)} : prev))
		}
		refreshAuditLog()
	}

	const toggleSelected = (id) => {
		setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
	}

	// Selects/clears every selectable row at once (excludes the current
	// admin's own account, same as the per-row checkboxes already do).
	const selectableUserIds = users ? users.filter((u) => u._id !== currentUser?._id).map((u) => u._id) : []
	const allSelected = selectableUserIds.length > 0 && selectableUserIds.every((id) => selectedIds.includes(id))
	const toggleSelectAll = () => {
		setSelectedIds(allSelected ? [] : selectableUserIds)
	}

	const handleBulkApplied = (actionKey, ids) => {
		if (actionKey === 'suspend') setUsers((prev) => prev.map((u) => (ids.includes(u._id) ? {...u, suspended: true} : u)))
		else if (actionKey === 'unsuspend') setUsers((prev) => prev.map((u) => (ids.includes(u._id) ? {...u, suspended: false} : u)))
		else if (actionKey === 'role_admin') setUsers((prev) => prev.map((u) => (ids.includes(u._id) ? {...u, role: 'admin'} : u)))
		else if (actionKey === 'role_user') setUsers((prev) => prev.map((u) => (ids.includes(u._id) ? {...u, role: 'user'} : u)))
		else if (actionKey === 'delete') {
			setUsers((prev) => prev.filter((u) => !ids.includes(u._id)))
			setStats((prev) => (prev ? {...prev, totalUsers: Math.max(0, prev.totalUsers - ids.length)} : prev))
		}
		refreshAuditLog()
	}

	// Same raw-fetch + manual Authorization header + Blob + temporary
	// <a download> pattern as Account.jsx's self-service export (axios
	// doesn't make authenticated blob downloads easy).
	const handleExportUser = async (u, format) => {
		const key = `${u._id}:${format}`
		setExportingKey(key)
		try {
			const token = getAuthToken()
			const res = await fetch(`${api.defaults.baseURL}/admin/users/${u._id}/export/${format}`, {
				headers: token ? {Authorization: `Bearer ${token}`} : {},
			})
			if (!res.ok) throw new Error('Export failed.')

			const blob = await res.blob()
			const disposition = res.headers.get('Content-Disposition') || ''
			const filenameMatch = disposition.match(/filename="([^"]+)"/)
			const filename = filenameMatch?.[1] || `notemind-export.${format === 'json' ? 'json' : 'zip'}`

			const url = URL.createObjectURL(blob)
			const link = document.createElement('a')
			link.href = url
			link.download = filename
			document.body.appendChild(link)
			link.click()
			link.remove()
			URL.revokeObjectURL(url)
			refreshAuditLog()
		} catch {
			toast.error(`Could not export ${u.name}'s notes.`)
		} finally {
			setExportingKey(null)
			setExportOpenId(null)
		}
	}

	const filteredAuditLog = auditLog && (auditFilter === 'all' ? auditLog : auditLog.filter((e) => ACTION_CATEGORY[e.action] === auditFilter))

	return (
		<div className="min-h-screen p-[18px] min-[761px]:p-7 flex flex-col gap-6 max-w-[1040px] mx-auto">
			<div className="flex items-center gap-3">
				<Link
					to="/dashboard"
					aria-label="Back to notes"
					className="w-9 h-9 shrink-0 rounded-[10px] flex items-center justify-center bg-ink/8 border border-ink/15 text-ink cursor-pointer transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-[0.98]"
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
				</Link>
				<h1 className="text-lg font-bold">Admin</h1>
				<span
					title={live ? 'Connected — data updates in real time' : 'Reconnecting…'}
					className={`flex items-center gap-1.5 py-1 px-2.5 rounded-full text-[10.5px] font-bold uppercase tracking-[0.05em] ${
						live ? 'bg-growth/15 text-growth' : 'bg-ink/8 text-ink/40'
					}`}
				>
					<span className={`w-1.5 h-1.5 rounded-full ${live ? 'bg-growth animate-[pulse_1.6s_ease-in-out_infinite]' : 'bg-ink/30'}`} />
					{live ? 'Live' : 'Offline'}
				</span>
			</div>

			<div className="flex flex-wrap gap-1.5 border-b border-ink/10 pb-3 -mt-1">
				{TABS.map(([key, label]) => (
					<button
						key={key}
						onClick={() => setActiveTab(key)}
						className={`py-1.5 px-3 rounded-[8px] text-[12.5px] font-semibold cursor-pointer transition-colors ${
							activeTab === key ? 'bg-accent/22 text-accent border border-accent/40' : 'bg-ink/6 border border-ink/12 text-ink/60 hover:text-ink'
						}`}
					>{label}</button>
				))}
			</div>

			{loading ? (
				<div className="h-[200px] flex items-center justify-center text-ink/40 text-[13px]">Loading…</div>
			) : (
				<>
					{activeTab === 'overview' && (
						<>
							<div className="grid grid-cols-2 min-[560px]:grid-cols-5 gap-3">
								<StatTile label="Total users" value={stats.totalUsers} />
								<StatTile label="Active (7d)" value={stats.activeUsers} />
								<StatTile label="New (7d)" value={stats.newUsersThisWeek} />
								<StatTile label="Total notes" value={stats.totalNotes} />
								<StatTile label="Total flashcards" value={stats.totalFlashcards} />
							</div>

							<div className="grid grid-cols-1 min-[640px]:grid-cols-2 gap-3">
								<GrowthChart
									label="Signups"
									data={growth}
									dataKey="signups"
									color="var(--color-accent)"
									total={growth.reduce((sum, d) => sum + d.signups, 0)}
								/>
								<GrowthChart
									label="Notes created"
									data={growth}
									dataKey="notes"
									color="var(--color-growth)"
									total={growth.reduce((sum, d) => sum + d.notes, 0)}
								/>
							</div>
						</>
					)}

					{activeTab === 'users' && (
						<>
							<AdminBulkActionBar
								selectedIds={selectedIds}
								users={users}
								onCleared={() => setSelectedIds([])}
								onApplied={handleBulkApplied}
							/>

							<div className="rounded-[14px] border border-ink/12 bg-ink/4 overflow-hidden">
								<div className="overflow-x-auto">
									<table className="w-full text-[13px] border-collapse min-w-[900px]">
										<thead>
											<tr className="border-b border-ink/10 text-left text-[10.5px] font-bold uppercase tracking-[0.05em] text-ink/40">
												<th className="py-2.5 px-3.5 w-8">
													{selectableUserIds.length > 0 && (
														<input type="checkbox" checked={allSelected} onChange={toggleSelectAll} title="Select all" />
													)}
												</th>
												<th className="py-2.5 px-3.5">User</th>
												<th className="py-2.5 px-3.5">Sign-in</th>
												<th className="py-2.5 px-3.5">Joined</th>
												<th className="py-2.5 px-3.5">Last active</th>
												<th className="py-2.5 px-3.5 text-right">Notes</th>
												<th className="py-2.5 px-3.5 text-right">Flashcards</th>
												<th className="py-2.5 px-3.5">Actions</th>
											</tr>
										</thead>
										<tbody>
											{users.map((u) => {
												const isSelf = u._id === currentUser?._id
												const acting = actingOnId === u._id
												return (
													<tr key={u._id} className="border-b border-ink/6 last:border-0">
														<td className="py-2.5 px-3.5">
															{!isSelf && (
																<input
																	type="checkbox"
																	checked={selectedIds.includes(u._id)}
																	onChange={() => toggleSelected(u._id)}
																/>
															)}
														</td>
														<td className="py-2.5 px-3.5">
															<div className="font-semibold flex items-center gap-1.5">
																{u.name}
																{u.role === 'admin' && <span className="text-[10px] font-bold uppercase tracking-[0.04em] text-accent">Admin</span>}
																{u.suspended && <span className="text-[10px] font-bold uppercase tracking-[0.04em] text-danger-light">Suspended</span>}
															</div>
															<div className="text-ink/45 text-[12px]">{u.email}</div>
														</td>
														<td className="py-2.5 px-3.5 text-ink/60 capitalize">{u.authProvider}</td>
														<td className="py-2.5 px-3.5 text-ink/60">{relativeTime(u.createdAt)}</td>
														<td className="py-2.5 px-3.5 text-ink/60">{u.lastActiveAt || u.lastLoginAt ? activityStatus(u.lastActiveAt || u.lastLoginAt, now) : 'Never'}</td>
														<td className="py-2.5 px-3.5 text-right tabular-nums">{u.noteCount}</td>
														<td className="py-2.5 px-3.5 text-right tabular-nums">{u.flashcardCount}</td>
														<td className="py-2.5 px-3.5">
															<div className="flex items-center gap-1.5 flex-wrap max-w-[320px]">
																<button
																	onClick={() => setContentUserId(u._id)}
																	className={`${actionBtnClass} bg-ink/8 border border-ink/15 text-ink/70 hover:text-ink`}
																>Content</button>
																<div className="relative">
																	<button
																		onClick={() => setExportOpenId((id) => (id === u._id ? null : u._id))}
																		className={`${actionBtnClass} bg-ink/8 border border-ink/15 text-ink/70 hover:text-ink`}
																	>Export ▾</button>
																	{exportOpenId === u._id && (
																		<div className="absolute z-10 top-full left-0 mt-1 flex flex-col rounded-[8px] border border-ink/15 bg-ink-deep/95 overflow-hidden shadow-[0_8px_20px_rgba(0,0,0,0.4)]">
																			<button
																				onClick={() => handleExportUser(u, 'json')}
																				disabled={exportingKey === `${u._id}:json`}
																				className="py-1.5 px-3 text-[11.5px] text-left whitespace-nowrap text-ink/70 hover:text-ink hover:bg-ink/10 disabled:opacity-40"
																			>{exportingKey === `${u._id}:json` ? 'Exporting…' : 'Export JSON'}</button>
																			<button
																				onClick={() => handleExportUser(u, 'markdown')}
																				disabled={exportingKey === `${u._id}:markdown`}
																				className="py-1.5 px-3 text-[11.5px] text-left whitespace-nowrap text-ink/70 hover:text-ink hover:bg-ink/10 disabled:opacity-40"
																			>{exportingKey === `${u._id}:markdown` ? 'Exporting…' : 'Export Markdown'}</button>
																		</div>
																	)}
																</div>
																{isSelf ? (
																	<span className="text-ink/30 text-[11px] py-1">self</span>
																) : (
																	<>
																		<button
																			onClick={() => handleToggleRole(u)}
																			disabled={acting}
																			className={`${actionBtnClass} bg-ink/8 border border-ink/15 text-ink/70 hover:text-ink`}
																		>{u.role === 'admin' ? 'Demote' : 'Promote'}</button>
																		<button
																			onClick={() => handleToggleSuspend(u)}
																			disabled={acting}
																			className={`${actionBtnClass} bg-ink/8 border border-ink/15 text-ink/70 hover:text-ink`}
																		>{u.suspended ? 'Unsuspend' : 'Suspend'}</button>
																		<button
																			onClick={() => handleResetPassword(u)}
																			disabled={acting}
																			className={`${actionBtnClass} bg-ink/8 border border-ink/15 text-ink/70 hover:text-ink`}
																		>Reset pw</button>
																		<button
																			onClick={() => setDeleteTarget(u)}
																			disabled={acting}
																			className={`${actionBtnClass} bg-danger/15 border border-danger/30 text-danger-light hover:bg-danger/25`}
																		>Delete</button>
																	</>
																)}
															</div>
														</td>
													</tr>
												)
											})}
										</tbody>
									</table>
								</div>
							</div>
						</>
					)}

					{activeTab === 'content' && (
						<div className="flex flex-col gap-2.5">
							<h2 className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink/40">Pick a user to view their content</h2>
							<div className="rounded-[14px] border border-ink/12 bg-ink/4 divide-y divide-ink/6">
								{users.length === 0 ? (
									<p className="text-[13px] text-ink/40 p-4">No users yet.</p>
								) : (
									users.map((u) => (
										<button
											key={u._id}
											onClick={() => setContentUserId(u._id)}
											className="w-full flex items-center justify-between gap-3 py-2.5 px-3.5 text-left cursor-pointer hover:bg-ink/5 transition-colors"
										>
											<div className="min-w-0">
												<div className="text-[13px] font-semibold truncate">{u.name}</div>
												<div className="text-ink/45 text-[12px] truncate">{u.email}</div>
											</div>
											<div className="shrink-0 flex items-center gap-3 text-[11.5px] text-ink/45 tabular-nums">
												<span>{u.noteCount} notes</span>
												<span>{u.flashcardCount} cards</span>
											</div>
										</button>
									))
								)}
							</div>
						</div>
					)}

					{activeTab === 'notifications' && (
						<div className="flex flex-col gap-2.5">
							<div className="flex items-center justify-between">
								<h2 className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink/40">Notifications sent</h2>
								<button
									onClick={() => setShowSendModal(true)}
									className="py-1.5 px-3 rounded-[7px] text-[11.5px] font-semibold bg-accent/20 text-accent cursor-pointer transition-colors hover:bg-accent/28"
								>+ Send notification</button>
							</div>
							<div className="rounded-[14px] border border-ink/12 bg-ink/4 divide-y divide-ink/6">
								{notifications.length === 0 ? (
									<p className="text-[13px] text-ink/40 p-4">No notifications sent yet.</p>
								) : (
									notifications.map((n) => (
										<NotificationRow
											key={n._id}
											notification={n}
											expanded={expandedNotifId === n._id}
											onToggleExpand={() => setExpandedNotifId((id) => (id === n._id ? null : n._id))}
											onDelete={() => handleDeleteNotification(n._id)}
										/>
									))
								)}
							</div>
						</div>
					)}

					{activeTab === 'audit' && (
						<div className="flex flex-col gap-2.5">
							<div className="flex items-center justify-between gap-2">
								<h2 className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink/40">Recent activity</h2>
								<select
									value={auditFilter}
									onChange={(e) => setAuditFilter(e.target.value)}
									className="text-[11.5px] font-semibold py-1 px-2 rounded-[6px] bg-ink/8 border border-ink/15 text-ink/70 cursor-pointer"
								>
									{AUDIT_CATEGORIES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
								</select>
							</div>
							<div className="rounded-[14px] border border-ink/12 bg-ink/4 divide-y divide-ink/6">
								{filteredAuditLog.length === 0 ? (
									<p className="text-[13px] text-ink/40 p-4">No admin actions{auditFilter !== 'all' ? ' in this category' : ''} yet.</p>
								) : (
									filteredAuditLog.map((e) => (
										<div key={e._id} className="flex items-center justify-between gap-3 py-2.5 px-3.5 text-[12.5px]">
											<span className="text-ink/70">
												<span className="font-semibold text-ink">{e.adminName}</span> {ACTION_VERBS[e.action] || e.action} {e.targetLabel}
											</span>
											<span className="shrink-0 text-ink/40">{relativeTime(e.createdAt)}</span>
										</div>
									))
								)}
							</div>
						</div>
					)}

					{activeTab === 'system' && <AdminSystemPanel system={system} />}
				</>
			)}

			<ConfirmModal
				isOpen={!!deleteTarget}
				title="Delete this user?"
				message={deleteTarget ? `"${deleteTarget.name}" (${deleteTarget.email}) and all their notes, flashcards, and version history will be permanently deleted. This can't be undone.` : ''}
				confirmLabel="Delete forever"
				onConfirm={handleConfirmDelete}
				onCancel={() => setDeleteTarget(null)}
			/>

			{contentUserId && <AdminUserContentModal userId={contentUserId} onClose={() => setContentUserId(null)} onNoteChanged={handleContentChanged} />}
			{passwordResetResult && <AdminPasswordResetModal result={passwordResetResult} onClose={() => setPasswordResetResult(null)} />}
			{showSendModal && users && (
				<SendNotificationModal users={users} onClose={() => setShowSendModal(false)} onSent={refreshAuditLog} />
			)}
		</div>
	)
}

export default Admin
