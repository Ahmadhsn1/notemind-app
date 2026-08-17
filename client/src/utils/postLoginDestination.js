// Shared by Login.jsx's password path and GoogleAuthButton's (used on both
// Login and Register). App.jsx's <Navigate to="/login" state={{from: location}} />
// is the only place that ever sets `from` — Register never does, so this
// always falls back to '/dashboard' there, exactly as before this existed.
//
// Without this, an unauthenticated visit to e.g. /dashboard?note=<id> (a
// reminder email link) redirected to /login, and <Navigate> drops the query
// string — so even after signing in, the note the email pointed at was gone.
export const postLoginDestination = (location) => {
	const from = location.state?.from
	return from ? `${from.pathname}${from.search}` : '/dashboard'
}
