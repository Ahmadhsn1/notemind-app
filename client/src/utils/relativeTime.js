export function relativeTime(dateString) {
	const date = new Date(dateString)
	const seconds = Math.floor((Date.now() - date.getTime()) / 1000)

	if (seconds < 60) return 'Just now'
	const minutes = Math.floor(seconds / 60)
	if (minutes < 60) return `${minutes}m ago`
	const hours = Math.floor(minutes / 60)
	if (hours < 24) return `${hours}h ago`
	const days = Math.floor(hours / 24)
	if (days === 1) return 'Yesterday'
	if (days < 7) return `${days}d ago`
	const weeks = Math.floor(days / 7)
	if (weeks < 4) return `${weeks}w ago`

	return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const ACTIVE_THRESHOLD_MS = 30 * 1000
const MINUTE_MS = 60 * 1000

// "Active"/"less than a min"/"X min" tiers for the admin dashboard's Users
// table specifically — distinct from relativeTime() above (used elsewhere
// for note/audit-log timestamps, which should keep their own wording).
// Takes `now` as an argument rather than reading Date.now() internally so a
// caller can re-invoke this on a ticking interval and get a genuinely live
// label, instead of one that's frozen at whatever moment it last rendered.
export function activityStatus(lastLoginAt, now = Date.now()) {
	const elapsed = now - new Date(lastLoginAt).getTime()
	if (elapsed < ACTIVE_THRESHOLD_MS) return 'Active'
	if (elapsed < MINUTE_MS) return 'less than a min'

	const minutes = Math.floor(elapsed / MINUTE_MS)
	if (minutes < 60) return `${minutes} min`
	const hours = Math.floor(minutes / 60)
	if (hours < 24) return `${hours}h ago`
	const days = Math.floor(hours / 24)
	if (days === 1) return 'Yesterday'
	if (days < 7) return `${days}d ago`
	const weeks = Math.floor(days / 7)
	if (weeks < 4) return `${weeks}w ago`

	return new Date(lastLoginAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
