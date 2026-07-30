import {useState} from 'react'
import {useNavigate} from 'react-router-dom'
import api from '../api/axios'
import {useAuth} from '../context/AuthContext'
import {LogoMark} from '../components/Logo'

// Deliberately separate from Login.jsx rather than a "you're an admin" branch
// of it — a distinct, unlisted portal (not linked from the regular login
// page) reads as a genuinely different entry point, matching how most
// SaaS products keep staff/admin sign-in out of the public-facing flow.
//
// Reuses POST /auth/login rather than duplicating password-verification
// logic server-side — the difference from a normal login is entirely in
// what this page does with a successful response: a correct password for a
// non-admin account is rejected here (session never stored, never
// redirected) rather than treated as a valid sign-in.
function AdminLogin() {
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [error, setError] = useState('')
	const [loading, setLoading] = useState(false)

	const {login} = useAuth()
	const navigate = useNavigate()

	const handleSubmit = async (e) => {
		e.preventDefault()
		setError('')
		setLoading(true)
		try {
			const response = await api.post('/auth/login', {email, password})
			if (response.data.role !== 'admin') {
				setError('This account does not have admin access.')
				return
			}
			login(response.data)
			navigate('/admin')
		} catch (err) {
			setError(err.response?.data?.message || 'Something went wrong')
		} finally {
			setLoading(false)
		}
	}

	return (
		<div className="flex justify-center items-center min-h-screen p-5">
			<div className="w-full max-w-[420px] rounded-[20px] border border-danger/25 bg-ink/7 backdrop-blur-[18px] py-10 px-6 min-[481px]:px-[52px]">
				<div className="flex items-center justify-center gap-2 mb-1.5">
					<LogoMark size={26} />
					<span className="text-[20px] font-bold">NoteMind</span>
				</div>
				<p className="text-center text-[11px] font-bold uppercase tracking-[0.08em] text-danger-light mb-[30px]">Admin sign-in</p>
				<form onSubmit={handleSubmit} className="flex flex-col gap-[16px]">
					<input
						type="email"
						placeholder="Admin email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						className="border border-ink/12 rounded-[10px] outline-none bg-ink/8 text-ink placeholder-ink/40 transition-colors duration-200 focus:border-danger-light focus:bg-ink/12 py-[14px] px-4 text-[15px]"
					/>
					<input
						type="password"
						placeholder="Password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						className="border border-ink/12 rounded-[10px] outline-none bg-ink/8 text-ink placeholder-ink/40 transition-colors duration-200 focus:border-danger-light focus:bg-ink/12 py-[14px] px-4 text-[15px]"
					/>
					{error && <p className="text-danger-light text-sm text-center">{error}</p>}
					<button
						type="submit"
						disabled={loading}
						className="bg-danger text-ink rounded-[10px] font-semibold cursor-pointer transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed p-[14px] text-[15px] mt-1"
					>
						{loading ? 'Checking…' : 'Sign in as admin'}
					</button>
				</form>
			</div>
		</div>
	)
}

export default AdminLogin
