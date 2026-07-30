import {GoogleOAuthProvider, GoogleLogin} from '@react-oauth/google'
import {useNavigate} from 'react-router-dom'
import api from '../api/axios'
import {useAuth} from '../context/AuthContext'
import {useToast} from '../context/ToastContext'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

// Renders nothing if no client ID is configured (see client/.env.example)
// rather than showing a button that can only ever fail — progressive
// enhancement, same approach as the dictation mic button in NoteEditor.
function GoogleAuthButton() {
	const {login} = useAuth()
	const toast = useToast()
	const navigate = useNavigate()

	if (!CLIENT_ID) return null

	const handleSuccess = async (credentialResponse) => {
		try {
			const response = await api.post('/auth/google', {credential: credentialResponse.credential})
			login(response.data)
			navigate('/dashboard')
		} catch (err) {
			toast.error(err.response?.data?.message || 'Google sign-in failed. Try again.')
		}
	}

	return (
		<GoogleOAuthProvider clientId={CLIENT_ID}>
			<div className="flex items-center gap-3 my-1">
				<div className="flex-1 h-px bg-ink/12" />
				<span className="text-[12px] text-ink/40">or</span>
				<div className="flex-1 h-px bg-ink/12" />
			</div>
			<div className="flex justify-center [&>div]:w-full">
				<GoogleLogin
					onSuccess={handleSuccess}
					onError={() => toast.error('Google sign-in failed. Try again.')}
					theme="filled_black"
					width="100%"
					text="continue_with"
				/>
			</div>
		</GoogleOAuthProvider>
	)
}

export default GoogleAuthButton
