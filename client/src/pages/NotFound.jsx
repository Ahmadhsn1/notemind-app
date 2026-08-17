import {Link} from 'react-router-dom'
import Logo from '../components/Logo'
import {useAuth} from '../context/AuthContext'

// Catch-all for any path that matches no other <Route> — see App.jsx's
// trailing path="*". Before this existed, an unmatched path (a typo'd link,
// an old bookmark, a stray crawler hit) rendered nothing at all: React
// Router simply has no element to show, so the page was just blank.
function NotFound() {
	const {user} = useAuth()

	return (
		<div className="min-h-screen flex flex-col items-center justify-center gap-5 p-5 text-center">
			<Logo size={30} textSize="text-[26px]" />
			<div>
				<p className="text-[15px] font-bold text-ink/70 mb-1">404 — Page not found</p>
				<p className="text-[13.5px] text-ink/50">The page you're looking for doesn't exist or may have moved.</p>
			</div>
			<Link to={user ? '/dashboard' : '/'} className="btn-primary px-5 py-2.5 text-[13.5px] no-underline">
				{user ? 'Back to your notes' : 'Back to home'}
			</Link>
		</div>
	)
}

export default NotFound
