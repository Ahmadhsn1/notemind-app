// sessionStorage (not localStorage) — a session survives page reloads within
// the SAME tab (so refreshing the dashboard doesn't kick you out) but does
// NOT survive opening a new tab/window or reopening the browser, so a shared
// computer can't just inherit someone else's login by navigating to a URL
// in a fresh tab or after the browser was closed.
const USER_KEY = 'user'
const TOKEN_KEY = 'token'

export const getStoredUser = () => {
	const raw = sessionStorage.getItem(USER_KEY)
	return raw ? JSON.parse(raw) : null
}

export const setStoredUser = (user) => sessionStorage.setItem(USER_KEY, JSON.stringify(user))

export const getStoredToken = () => sessionStorage.getItem(TOKEN_KEY)

export const setStoredToken = (token) => {
	if (token) sessionStorage.setItem(TOKEN_KEY, token)
	else sessionStorage.removeItem(TOKEN_KEY)
}

export const clearAuthStorage = () => {
	sessionStorage.removeItem(USER_KEY)
	sessionStorage.removeItem(TOKEN_KEY)
}
