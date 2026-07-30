import {useEffect, useRef, useState} from 'react'
import {Link} from 'react-router-dom'
import {io} from 'socket.io-client'
import api, {API_ORIGIN, getAuthToken} from '../api/axios'
import {useAuth} from '../context/AuthContext'
import {useToast} from '../context/ToastContext'
import {relativeTime} from '../utils/relativeTime'
import ConfirmModal from '../components/ConfirmModal'
import AdminNotesModal from '../components/AdminNotesModal'
import AdminPasswordResetModal from '../components/AdminPasswordResetModal'

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
}

const actionBtnClass = 'py-1 px-2 rounded-[6px] text-[11px] font-semibold cursor-pointer transition-[opacity,transform] duration-150 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap'

function Admin() {
	const {user: currentUser} = useAuth()
	const [stats, setStats] = useState(null)
	const [users, setUsers] = useState(null)
	const [growth, setGrowth] = useState(null)
	const [auditLog, setAuditLog] = useState(null)
	const [loading, setLoading] = useState(true)
	const [live, setLive] = useState(false)
	const [actingOnId, setActingOnId] = useState(null)
	const [deleteTarget, setDeleteTarget] = useState(null)
	const [notesUserId, setNotesUserId] = useState(null)
	const [passwordResetResult, setPasswordResetResult] = useState(null)
	const toast = useToast()
	const mountedRef = useRef(true)

	// Shared by the initial mount fetch and the socket-triggered refresh below
	// — `silent` skips the error toast for background refreshes (a transient
	// failure there shouldn't interrupt an admin mid-read the way a failed
	// initial load should) and never needs to re-arm the loading spinner,
	// since `loading` already starts `true` and only this function ever turns
	// it off.
	const loadAdminData = async (silent = false) => {
		try {
			const [statsRes, usersRes, growthRes, auditRes] = await Promise.all([
				api.get('/admin/stats'),
				api.get('/admin/users'),
				api.get('/admin/growth'),
				api.get('/admin/audit-log'),
			])
			if (!mountedRef.current) return
			setStats(statsRes.data)
			setUsers(usersRes.data)
			setGrowth(growthRes.data)
			setAuditLog(auditRes.data)
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

	const handleNoteDeleted = (userId) => {
		setUsers((prev) => prev.map((u) => (u._id === userId ? {...u, noteCount: Math.max(0, u.noteCount - 1)} : u)))
		setStats((prev) => (prev ? {...prev, totalNotes: Math.max(0, prev.totalNotes - 1)} : prev))
		refreshAuditLog()
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

			{loading ? (
				<div className="h-[200px] flex items-center justify-center text-ink/40 text-[13px]">Loading…</div>
			) : (
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

					<div className="rounded-[14px] border border-ink/12 bg-ink/4 overflow-hidden">
						<div className="overflow-x-auto">
							<table className="w-full text-[13px] border-collapse min-w-[820px]">
								<thead>
									<tr className="border-b border-ink/10 text-left text-[10.5px] font-bold uppercase tracking-[0.05em] text-ink/40">
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
													<div className="font-semibold flex items-center gap-1.5">
														{u.name}
														{u.role === 'admin' && <span className="text-[10px] font-bold uppercase tracking-[0.04em] text-accent">Admin</span>}
														{u.suspended && <span className="text-[10px] font-bold uppercase tracking-[0.04em] text-danger-light">Suspended</span>}
													</div>
													<div className="text-ink/45 text-[12px]">{u.email}</div>
												</td>
												<td className="py-2.5 px-3.5 text-ink/60 capitalize">{u.authProvider}</td>
												<td className="py-2.5 px-3.5 text-ink/60">{relativeTime(u.createdAt)}</td>
												<td className="py-2.5 px-3.5 text-ink/60">{u.lastLoginAt ? relativeTime(u.lastLoginAt) : 'Never'}</td>
												<td className="py-2.5 px-3.5 text-right tabular-nums">{u.noteCount}</td>
												<td className="py-2.5 px-3.5 text-right tabular-nums">{u.flashcardCount}</td>
												<td className="py-2.5 px-3.5">
													<div className="flex items-center gap-1.5 flex-wrap max-w-[260px]">
														<button
															onClick={() => setNotesUserId(u._id)}
															className={`${actionBtnClass} bg-ink/8 border border-ink/15 text-ink/70 hover:text-ink`}
														>Notes</button>
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

					<div className="flex flex-col gap-2.5">
						<h2 className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink/40">Recent activity</h2>
						<div className="rounded-[14px] border border-ink/12 bg-ink/4 divide-y divide-ink/6">
							{auditLog.length === 0 ? (
								<p className="text-[13px] text-ink/40 p-4">No admin actions yet.</p>
							) : (
								auditLog.map((e) => (
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

			{notesUserId && <AdminNotesModal userId={notesUserId} onClose={() => setNotesUserId(null)} onNoteDeleted={handleNoteDeleted} />}
			{passwordResetResult && <AdminPasswordResetModal result={passwordResetResult} onClose={() => setPasswordResetResult(null)} />}
		</div>
	)
}

export default Admin
