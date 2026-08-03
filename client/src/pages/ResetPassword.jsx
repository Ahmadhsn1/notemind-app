import {useState} from 'react'
import {Link, useNavigate, useSearchParams} from 'react-router-dom'
import api from '../api/axios'
import {useToast} from '../context/ToastContext'
import Logo from '../components/Logo'

function ResetPassword() {
	const [searchParams] = useSearchParams()
	const token = searchParams.get('token') || ''
	const navigate = useNavigate()
	const toast = useToast()

	const [newPassword, setNewPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [submitting, setSubmitting] = useState(false)
	const [error, setError] = useState('')

	const handleSubmit = async (e) => {
		e.preventDefault()
		if (submitting) return

		// Checked here as well as server-side purely so the user finds out
		// before spending their single-use token on a mismatch.
		if (newPassword !== confirmPassword) {
			setError('Those passwords do not match.')
			return
		}

		setSubmitting(true)
		setError('')
		try {
			await api.post('/auth/reset-password', {token, newPassword})
			toast.success('Password updated. Sign in with your new password.')
			navigate('/login')
		} catch (err) {
			setError(err.response?.data?.errors?.newPassword || err.response?.data?.message || 'Something went wrong. Try again.')
			setSubmitting(false)
		}
	}

	// A missing token means the link was truncated or hand-edited — say so
	// rather than showing a form that can only fail on submit.
	if (!token) {
		return (
			<div className="min-h-screen flex items-center justify-center p-4">
				<div className="w-full max-w-[400px] flex flex-col items-center gap-4 text-center">
					<Logo />
					<p className="text-[14px] text-ink/70">This reset link is incomplete.</p>
					<Link to="/forgot-password" className="text-[13px] text-accent font-semibold">Request a new one</Link>
				</div>
			</div>
		)
	}

	return (
		<div className="min-h-screen flex items-center justify-center p-4">
			<div className="w-full max-w-[400px] flex flex-col gap-5">
				<div className="flex flex-col items-center gap-2">
					<Logo />
					<h1 className="text-xl font-bold">Choose a new password</h1>
				</div>

				<form onSubmit={handleSubmit} className="flex flex-col gap-3">
					<input
						type="password"
						placeholder="New password"
						value={newPassword}
						onChange={(e) => setNewPassword(e.target.value)}
						required
						minLength={8}
						maxLength={200}
						autoFocus
						className="input-base w-full"
					/>
					<input
						type="password"
						placeholder="Confirm new password"
						value={confirmPassword}
						onChange={(e) => setConfirmPassword(e.target.value)}
						required
						minLength={8}
						maxLength={200}
						className="input-base w-full"
					/>
					<p className="text-[12px] text-ink/45">At least 8 characters.</p>
					{error && <p className="text-[12.5px] text-danger-light">{error}</p>}
					<button
						type="submit"
						disabled={submitting}
						className="btn-primary p-[15px] text-base disabled:opacity-60 disabled:cursor-not-allowed"
					>{submitting ? 'Updating…' : 'Update password'}</button>
					<Link to="/login" className="text-[13px] text-ink/50 hover:text-ink text-center mt-1">Back to sign in</Link>
				</form>
			</div>
		</div>
	)
}

export default ResetPassword
