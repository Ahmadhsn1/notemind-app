// Local calendar date as 'YYYY-MM-DD' — NOT toISOString(), which converts to
// UTC first and would shift the date by a day for any timezone ahead of UTC
// (e.g. local midnight in UTC+5 is still the previous day in UTC). Mirrors
// server/controllers/noteController.js's localIsoDate for the same reason.
export function toLocalDateKey(date) {
	const d = new Date(date)
	const y = d.getFullYear()
	const m = String(d.getMonth() + 1).padStart(2, '0')
	const day = String(d.getDate()).padStart(2, '0')
	return `${y}-${m}-${day}`
}
