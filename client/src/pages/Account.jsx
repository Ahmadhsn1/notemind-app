import {useEffect, useState} from 'react'
import {Link, useNavigate} from 'react-router-dom'
import api, {getAuthToken} from '../api/axios'
import {useAuth} from '../context/AuthContext'
import {useToast} from '../context/ToastContext'
import ConfirmModal from '../components/ConfirmModal'

function initials(name) {
	if (!name) return '?'
	const parts = name.trim().split(/\s+/)
	return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')
}

const cardClass = 'rounded-[16px] border border-ink/12 bg-ink/4 p-4 min-[481px]:p-5 flex flex-col gap-3.5'
const labelClass = 'text-[11px] font-bold uppercase tracking-[0.05em] text-ink/40'

function Account() {
	const {user, logout, updateUser} = useAuth()
	const toast = useToast()
	const navigate = useNavigate()

	const [name, setName] = useState(user?.name || '')
	const [email, setEmail] = useState(user?.email || '')
	const [profileSaving, setProfileSaving] = useState(false)
	const [memberSince, setMemberSince] = useState(null)

	const [currentPassword, setCurrentPassword] = useState('')
	const [newPassword, setNewPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [passwordSaving, setPasswordSaving] = useState(false)

	const [exporting, setExporting] = useState(null)

	const [deletePassword, setDeletePassword] = useState('')
	const [confirmingDelete, setConfirmingDelete] = useState(false)
	const [deleting, setDeleting] = useState(false)

	useEffect(() => {
		let ignore = false
		;(async () => {
			try {
				const response = await api.get('/auth/me')
				if (!ignore) setMemberSince(response.data.createdAt)
			} catch {
				// Non-critical — the rest of the page still works off the cached
				// user object without a join date shown.
			}
		})()
		return () => { ignore = true }
	}, [])

	const handleSaveProfile = async (e) => {
		e.preventDefault()
		if (profileSaving) return
		setProfileSaving(true)
		try {
			const response = await api.put('/auth/profile', {name, email})
			updateUser(response.data)
			toast.success('Profile updated.')
		} catch (err) {
			toast.error(err.response?.data?.message || 'Could not update profile.')
		} finally {
			setProfileSaving(false)
		}
	}

	const handleChangePassword = async (e) => {
		e.preventDefault()
		if (passwordSaving) return
		if (newPassword !== confirmPassword) {
			toast.error('New passwords do not match.')
			return
		}
		setPasswordSaving(true)
		try {
			await api.put('/auth/password', {currentPassword, newPassword})
			setCurrentPassword('')
			setNewPassword('')
			setConfirmPassword('')
			toast.success('Password updated.')
		} catch (err) {
			toast.error(err.response?.data?.message || 'Could not update password.')
		} finally {
			setPasswordSaving(false)
		}
	}

	const handleExport = async (format) => {
		if (exporting) return
		setExporting(format)
		try {
			const token = getAuthToken()
			const baseURL = api.defaults.baseURL
			const res = await fetch(`${baseURL}/notes/export/${format}`, {
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
		} catch {
			toast.error('Could not export your notes. Try again.')
		} finally {
			setExporting(null)
		}
	}

	const handleDeleteAccount = async () => {
		if (deleting) return
		setDeleting(true)
		try {
			await api.delete('/auth/account', {data: {password: deletePassword}})
			toast.success('Account deleted.')
			logout()
			navigate('/login')
		} catch (err) {
			toast.error(err.response?.data?.message || 'Could not delete account.')
			setDeleting(false)
			setConfirmingDelete(false)
		}
	}

	return (
		<div className="min-h-screen p-[18px] min-[761px]:p-7 flex flex-col gap-5 max-w-[560px] mx-auto">
			<div className="flex items-center gap-3">
				<Link
					to="/dashboard"
					aria-label="Back to notes"
					className="w-9 h-9 shrink-0 rounded-[10px] flex items-center justify-center bg-ink/8 border border-ink/15 text-ink cursor-pointer transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-[0.98]"
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
				</Link>
				<h1 className="text-lg font-bold">Account</h1>
			</div>

			<div className="flex items-center gap-3.5 py-1">
				<div className="w-12 h-12 rounded-full shrink-0 bg-gradient-to-br from-accent to-growth flex items-center justify-center text-base font-bold text-[#14161c]">{initials(name)}</div>
				<div>
					<div className="text-[15px] font-semibold">{user?.name}</div>
					<div className="text-[12px] text-ink/45">
						{user?.email}{memberSince ? ` · Joined ${new Date(memberSince).toLocaleDateString(undefined, {month: 'long', year: 'numeric'})}` : ''}
					</div>
				</div>
			</div>

			<form onSubmit={handleSaveProfile} className={cardClass}>
				<h2 className={labelClass}>Profile</h2>
				<div className="flex flex-col gap-1.5">
					<label className="text-[12.5px] text-ink/60" htmlFor="account-name">Name</label>
					<input id="account-name" className="input-base" value={name} onChange={(e) => setName(e.target.value)} required />
				</div>
				<div className="flex flex-col gap-1.5">
					<label className="text-[12.5px] text-ink/60" htmlFor="account-email">Email</label>
					<input id="account-email" type="email" className="input-base" value={email} onChange={(e) => setEmail(e.target.value)} required />
				</div>
				<button type="submit" disabled={profileSaving} className="btn-primary self-start py-2.5 px-4 text-[13px] disabled:opacity-50 disabled:cursor-not-allowed">
					{profileSaving ? 'Saving…' : 'Save profile'}
				</button>
			</form>

			<form onSubmit={handleChangePassword} className={cardClass}>
				<h2 className={labelClass}>Change password</h2>
				<div className="flex flex-col gap-1.5">
					<label className="text-[12.5px] text-ink/60" htmlFor="current-password">Current password</label>
					<input id="current-password" type="password" className="input-base" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" required />
				</div>
				<div className="flex flex-col gap-1.5">
					<label className="text-[12.5px] text-ink/60" htmlFor="new-password">New password</label>
					<input id="new-password" type="password" className="input-base" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" minLength={8} required />
				</div>
				<div className="flex flex-col gap-1.5">
					<label className="text-[12.5px] text-ink/60" htmlFor="confirm-password">Confirm new password</label>
					<input id="confirm-password" type="password" className="input-base" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" minLength={8} required />
				</div>
				<button type="submit" disabled={passwordSaving} className="btn-primary self-start py-2.5 px-4 text-[13px] disabled:opacity-50 disabled:cursor-not-allowed">
					{passwordSaving ? 'Updating…' : 'Update password'}
				</button>
			</form>

			<div className={cardClass}>
				<h2 className={labelClass}>Export your data</h2>
				<p className="text-[12.5px] text-ink/55 leading-[1.5]">
					Download every note you own as a full backup. JSON preserves all fields for re-import; Markdown gives you a readable file per note.
				</p>
				<div className="flex flex-wrap gap-2.5">
					<button
						type="button"
						onClick={() => handleExport('json')}
						disabled={exporting !== null}
						className="py-2.5 px-4 text-[13px] font-semibold rounded-[10px] bg-ink/6 border border-ink/12 text-ink/75 cursor-pointer transition-[opacity,transform] duration-200 hover:bg-ink/10 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{exporting === 'json' ? 'Preparing…' : 'Export as JSON'}
					</button>
					<button
						type="button"
						onClick={() => handleExport('markdown')}
						disabled={exporting !== null}
						className="py-2.5 px-4 text-[13px] font-semibold rounded-[10px] bg-ink/6 border border-ink/12 text-ink/75 cursor-pointer transition-[opacity,transform] duration-200 hover:bg-ink/10 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{exporting === 'markdown' ? 'Preparing…' : 'Export as Markdown (.zip)'}
					</button>
				</div>
			</div>

			<button
				onClick={logout}
				className="self-start py-2.5 px-4 text-[13px] font-semibold rounded-[10px] bg-ink/6 border border-ink/12 text-ink/75 cursor-pointer transition-[opacity,transform] duration-200 hover:bg-ink/10 active:scale-[0.98]"
			>Log out</button>

			<div className={`${cardClass} border-danger/30`}>
				<h2 className="text-[11px] font-bold uppercase tracking-[0.05em] text-danger-light">Danger zone</h2>
				<p className="text-[12.5px] text-ink/55 leading-[1.5]">
					Permanently delete your account and every note, flashcard, and version history tied to it. This can't be undone.
				</p>
				{user?.hasPassword !== false && (
					<div className="flex flex-col gap-1.5">
						<label className="text-[12.5px] text-ink/60" htmlFor="delete-password">Enter your password to confirm</label>
						<input
							id="delete-password"
							type="password"
							className="input-base"
							value={deletePassword}
							onChange={(e) => setDeletePassword(e.target.value)}
							autoComplete="current-password"
						/>
					</div>
				)}
				<button
					onClick={() => setConfirmingDelete(true)}
					disabled={user?.hasPassword !== false && !deletePassword}
					className="self-start py-2.5 px-4 text-[13px] font-semibold rounded-[10px] bg-danger border-none text-ink cursor-pointer transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
				>Delete my account</button>
			</div>

			<ConfirmModal
				isOpen={confirmingDelete}
				title="Delete your account?"
				message="This permanently deletes your account, notes, flashcards, and version history. This can't be undone."
				confirmLabel={deleting ? 'Deleting…' : 'Delete forever'}
				onConfirm={handleDeleteAccount}
				onCancel={() => setConfirmingDelete(false)}
			/>
		</div>
	)
}

export default Account
