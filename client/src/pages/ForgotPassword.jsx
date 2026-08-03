import {useState} from 'react'
import {Link} from 'react-router-dom'
import api from '../api/axios'
import Logo from '../components/Logo'

function ForgotPassword() {
	const [email, setEmail] = useState('')
	const [submitting, setSubmitting] = useState(false)
	const [sent, setSent] = useState(false)
	const [error, setError] = useState('')

	const handleSubmit = async (e) => {
		e.preventDefault()
		if (submitting) return
		setSubmitting(true)
		setError('')
		try {
			await api.post('/auth/forgot-password', {email})
			// The server answers identically whether or not the address has an
			// account, so this screen must too — anything that distinguished the
			// two would hand out an account-enumeration oracle.
			setSent(true)
		} catch (err) {
			setError(err.response?.data?.message || 'Something went wrong. Try again.')
			setSubmitting(false)
		}
	}

	return (
		<div className="min-h-screen flex items-center justify-center p-4">
			<div className="w-full max-w-[400px] flex flex-col gap-5">
				<div className="flex flex-col items-center gap-2">
					<Logo />
					<h1 className="text-xl font-bold">Reset your password</h1>
				</div>

				{sent ? (
					<div className="rounded-[16px] border border-ink/12 bg-ink/4 p-5 flex flex-col gap-3 text-center">
						<p className="text-[14px] text-ink/80 leading-[1.6]">
							If an account exists for <strong className="text-ink">{email}</strong>, a reset link is on its way.
						</p>
						<p className="text-[12.5px] text-ink/50 leading-[1.5]">
							The link expires in an hour. Check your spam folder if it doesn&apos;t arrive.
						</p>
						<Link to="/login" className="text-[13px] text-accent font-semibold mt-1">Back to sign in</Link>
					</div>
				) : (
					<form onSubmit={handleSubmit} className="flex flex-col gap-3">
						<p className="text-[13px] text-ink/60 leading-[1.5] text-center">
							Enter your email and we&apos;ll send you a link to choose a new password.
						</p>
						<input
							type="email"
							placeholder="you@example.com"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							required
							autoFocus
							maxLength={200}
							className="input-base w-full"
						/>
						{error && <p className="text-[12.5px] text-danger-light">{error}</p>}
						<button
							type="submit"
							disabled={submitting}
							className="btn-primary p-[15px] text-base disabled:opacity-60 disabled:cursor-not-allowed"
						>{submitting ? 'Sending…' : 'Send reset link'}</button>
						<Link to="/login" className="text-[13px] text-ink/50 hover:text-ink text-center mt-1">Back to sign in</Link>
					</form>
				)}
			</div>
		</div>
	)
}

export default ForgotPassword
