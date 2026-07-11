import {useState, useRef, useEffect} from 'react'
import {useNavigate, Link} from 'react-router-dom'
import api from '../api/axios'
import {useAuth} from '../context/AuthContext'
import Watchers from '../components/Watchers'

function Login() {
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [showPassword, setShowPassword] = useState(false)
	const [error, setError] = useState('')
	const [focusedField, setFocusedField] = useState(null)
	const [glancing, setGlancing] = useState(false)
	const [avoiding, setAvoiding] = useState(false)
	const [nudgeExpired, setNudgeExpired] = useState(false)
	const [bounceKey, setBounceKey] = useState(0)
	const formRef = useRef(null)
	const glanceTimeoutRef = useRef(null)

	const {login} = useAuth()
	const navigate = useNavigate()

	const wantsNudge = showPassword && (focusedField === 'email' || focusedField === 'name')
	const nudging = wantsNudge && !nudgeExpired

	const watcherMode =
		focusedField === 'password' ? 'shy' :
		nudging ? 'remind' :
		focusedField ? 'lookAtForm' :
		glancing ? 'glance' :
		avoiding ? 'shy' : 'watch'

	useEffect(() => {
		const handleOutsideClick = (e) => {
			if (formRef.current && !formRef.current.contains(e.target)) {
				clearTimeout(glanceTimeoutRef.current)
				setGlancing(false)
				setAvoiding(false)
			}
		}
		document.addEventListener('mousedown', handleOutsideClick)
		return () => document.removeEventListener('mousedown', handleOutsideClick)
	}, [])

	// Cancel any pending glance->shy transition if the component unmounts
	// (e.g. successful login navigates away) mid-animation.
	useEffect(() => {
		return () => clearTimeout(glanceTimeoutRef.current)
	}, [])

	// Nudge the mascots to remind the user to hide their password once they
	// move on to typing another field while it's still visible. Auto-expires
	// after 1.4s even if they keep typing, then resets for the next time.
	useEffect(() => {
		if (!wantsNudge) return
		const timeoutId = setTimeout(() => setNudgeExpired(true), 1400)
		return () => {
			clearTimeout(timeoutId)
			setNudgeExpired(false)
		}
	}, [wantsNudge])

	const handleTogglePassword = () => {
		const newVal = !showPassword
		setShowPassword(newVal)
		clearTimeout(glanceTimeoutRef.current)
		if (newVal) {
			// Brief glance at the revealed password, then flinch shy + blush.
			setGlancing(true)
			setAvoiding(false)
			glanceTimeoutRef.current = setTimeout(() => {
				setGlancing(false)
				setAvoiding(true)
				setBounceKey((k) => k + 1)
			}, 500)
		} else {
			setGlancing(false)
			setAvoiding(false)
		}
	}

	const handleSubmit = async (e) => {
		e.preventDefault()
		setError('')
		try {
			const response = await api.post('/auth/login', {email, password})
			login(response.data)
			navigate('/dashboard')
		} catch (err) {
			setError(err.response?.data?.message || 'Something went wrong')
		}
	}

	return (
		<div className="flex justify-center items-center min-h-screen p-5 overflow-x-hidden">
			<div className="flex flex-col items-center justify-center gap-8 w-full max-w-[1100px] min-[800px]:flex-row min-[800px]:gap-[110px]">
				<Watchers mode={watcherMode} bounceKey={bounceKey} />
				<div className="w-full max-w-[520px] rounded-[20px] border border-white/15 bg-white/7 backdrop-blur-[18px] py-8 px-6 min-[481px]:py-14 min-[481px]:px-[52px]">
					<div className="text-center text-[34px] font-bold bg-gradient-to-r from-[#a29bfe] to-[#e84393] bg-clip-text text-transparent mb-1.5">NoteMind</div>
					<p className="text-center text-[15px] text-white/55 mb-[34px]">Your thoughts, organized and alive</p>
					<form onSubmit={handleSubmit} ref={formRef} className="flex flex-col gap-[18px]">
						<input
							type="email"
							placeholder="Email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							onFocus={() => setFocusedField('email')}
							onBlur={() => setFocusedField(null)}
							className="border border-white/12 rounded-[10px] outline-none bg-white/8 text-white placeholder-white/40 transition-colors duration-200 focus:border-[#a29bfe] focus:bg-white/12 py-[15px] px-4 text-[15px]"
						/>
						<div className="relative flex items-center">
							<input
								type={showPassword ? 'text' : 'password'}
								placeholder="Password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								onFocus={() => setFocusedField('password')}
								onBlur={() => setFocusedField(null)}
								className="w-full border border-white/12 rounded-[10px] outline-none bg-white/8 text-white placeholder-white/40 transition-colors duration-200 focus:border-[#a29bfe] focus:bg-white/12 py-[15px] pl-4 pr-16 text-[15px]"
							/>
							<button
								type="button"
								onClick={handleTogglePassword}
								className="absolute right-2 bg-transparent border-none text-[#a29bfe] font-semibold p-[15px] text-base mt-1.5 cursor-pointer transition-[opacity,transform] duration-200 hover:opacity-80 active:scale-[0.98]"
							>
								{showPassword ? 'Hide' : 'Show'}
							</button>
						</div>
						{error && <p className="text-[#ff7675] text-sm text-center">{error}</p>}
						<button type="submit" className="btn-primary p-[15px] text-base mt-1.5">Login</button>
					</form>
					<p className="text-center mt-[18px] text-sm text-white/50">
						Don't have an account? <Link to="/register" className="text-[#a29bfe] no-underline font-semibold">Register</Link>
					</p>
				</div>
			</div>
		</div>
	)
}

export default Login
