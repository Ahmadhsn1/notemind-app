import {GoogleOAuthProvider, GoogleLogin} from '@react-oauth/google'
import {useState} from 'react'
import api from '../api/axios'
import {useToast} from '../context/ToastContext'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

// Connects/disconnects a Google identity from inside an authenticated
// session. This is the only way to link Google to an existing account:
// POST /auth/google deliberately refuses to adopt an account that merely
// shares an email address, because nothing in this app verifies email
// ownership and an attacker could otherwise pre-claim someone's address and
// capture their first Google sign-in.
//
// Renders nothing without a configured client ID, same as GoogleAuthButton —
// a button that can only fail is worse than no button.
function GoogleLinkButton({hasGoogle, hasPassword, onChange}) {
	const toast = useToast()
	const [busy, setBusy] = useState(false)

	if (!CLIENT_ID) return null

	const handleSuccess = async (credentialResponse) => {
		if (busy) return
		setBusy(true)
		try {
			const res = await api.post('/auth/google/link', {credential: credentialResponse.credential})
			toast.success(`Google connected${res.data.googleEmail ? ` (${res.data.googleEmail})` : ''}.`)
			onChange?.(true)
		} catch (err) {
			toast.error(err.response?.data?.message || 'Could not connect Google. Try again.')
		} finally {
			setBusy(false)
		}
	}

	const handleUnlink = async () => {
		if (busy) return
		setBusy(true)
		try {
			await api.delete('/auth/google/link')
			toast.success('Google disconnected.')
			onChange?.(false)
		} catch (err) {
			toast.error(err.response?.data?.message || 'Could not disconnect Google.')
		} finally {
			setBusy(false)
		}
	}

	if (hasGoogle) {
		return (
			<div className="flex items-center justify-between gap-3 flex-wrap">
				<span className="text-[13px] text-ink/70 flex items-center gap-2">
					<span className="w-1.5 h-1.5 rounded-full bg-growth" />
					Google is connected to this account.
				</span>
				<button
					onClick={handleUnlink}
					// Without a password, unlinking would leave no way to sign in at
					// all — and this app has no email-based recovery.
					disabled={busy || !hasPassword}
					title={hasPassword ? undefined : 'Set a password first — otherwise you would be locked out'}
					className="py-2 px-3.5 rounded-[10px] bg-ink/8 border border-ink/15 text-[12.5px] font-semibold text-ink/75 cursor-pointer transition-colors hover:bg-ink/12 disabled:opacity-50 disabled:cursor-not-allowed"
				>{busy ? 'Working…' : 'Disconnect'}</button>
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-2.5">
			<p className="text-[13px] text-ink/60 leading-[1.5]">
				Connect your Google account to sign in with one click.
			</p>
			<GoogleOAuthProvider clientId={CLIENT_ID}>
				<div className="flex [&>div]:w-full max-w-[320px]">
					<GoogleLogin
						onSuccess={handleSuccess}
						onError={() => toast.error('Could not connect Google. Try again.')}
						theme="filled_black"
						width="100%"
						text="continue_with"
					/>
				</div>
			</GoogleOAuthProvider>
		</div>
	)
}

export default GoogleLinkButton
