import {useEffect, useMemo, useState} from 'react'
import {useParams, Link} from 'react-router-dom'
import api, {resolveUploadUrl} from '../api/axios'
import {sanitizeNoteHtml} from '../utils/sanitizeNoteHtml'
import Logo from '../components/Logo'
import {useAuth} from '../context/AuthContext'
import {relativeTime} from '../utils/relativeTime'

// Public, unauthenticated route (see App.jsx) — the client-side counterpart
// to GET /api/public/notes/:token (publicNoteController.js). Deliberately a
// plain `fetch`-via-axios GET with no auth header required: the shared api
// instance still works fine here since it only *attaches* a token if one
// exists, and this endpoint never requires one.
//
// Growth loop, not just a neutral viewer (explicit product decision — see
// the plan): every shared note carries NoteMind branding and a "Start free"
// CTA, both in the header and after the note itself. A shared link is the
// only place a stranger who has never heard of NoteMind ever lands.
const NOT_SHARED_MESSAGE = "This link is invalid, or the note is no longer shared."

// Server already signs image URLs in the returned contentHtml (see
// publicNoteController.signImagesInHtml) — this just makes the relative
// /uploads/... paths absolute, the same resolveUploadUrl every other note
// viewer uses. No second network round-trip needed, unlike the
// pending/signed two-phase dance NoteViewModal does for an authenticated
// note (that exists because *unsigned* paths need signing; these already
// arrive signed).
const resolveImages = (html) => {
	if (!html || !html.includes('/uploads/')) return html
	const doc = new DOMParser().parseFromString(html, 'text/html')
	doc.querySelectorAll('img[src^="/uploads/"]').forEach((img) => {
		img.setAttribute('src', resolveUploadUrl(img.getAttribute('src')))
	})
	return doc.body.innerHTML
}

function Share() {
	const {token} = useParams()
	const {user} = useAuth()
	const [note, setNote] = useState(null)
	const [loading, setLoading] = useState(true)
	const [notFound, setNotFound] = useState(false)

	/* eslint-disable react-hooks/set-state-in-effect -- fetching an external resource keyed by the URL param, not deriving state from a render */
	useEffect(() => {
		let ignore = false
		setLoading(true)
		setNotFound(false)
		api.get(`/public/notes/${token}`)
			.then((res) => { if (!ignore) setNote(res.data) })
			.catch(() => { if (!ignore) setNotFound(true) })
			.finally(() => { if (!ignore) setLoading(false) })
		return () => { ignore = true }
	}, [token])
	/* eslint-enable react-hooks/set-state-in-effect */

	// No react-helmet in this app (see index.html — plain static tags) — a
	// shared note must never be indexed (the server already sends
	// X-Robots-Tag, but that header alone doesn't stop a crawler that
	// renders the SPA and reads its DOM), so this is inserted directly and
	// removed on unmount rather than left to leak onto every other route.
	useEffect(() => {
		const meta = document.createElement('meta')
		meta.name = 'robots'
		meta.content = 'noindex, nofollow'
		document.head.appendChild(meta)
		return () => { document.head.removeChild(meta) }
	}, [])

	const safeHtml = useMemo(() => resolveImages(sanitizeNoteHtml(note?.contentHtml || '')), [note])

	return (
		<div className="min-h-screen flex flex-col">
			<header className="border-b border-ink/8">
				<div className="flex items-center justify-between max-w-[720px] w-full mx-auto px-5 py-3.5">
					<Link to={user ? '/dashboard' : '/'} className="no-underline"><Logo size={24} textSize="text-[19px]" /></Link>
					{user ? (
						<Link to="/dashboard" className="btn-primary px-4 py-2 text-[13px] no-underline whitespace-nowrap">Open my notes</Link>
					) : (
						<nav className="flex items-center gap-2.5">
							<Link to="/login" className="text-ink/65 hover:text-ink no-underline text-[13px] font-medium px-2 py-2">Login</Link>
							<Link to="/register" className="btn-primary px-4 py-2 text-[13px] no-underline whitespace-nowrap">Start free</Link>
						</nav>
					)}
				</div>
			</header>

			<main className="flex-1 max-w-[720px] w-full mx-auto px-5 py-10">
				{loading ? (
					<div className="text-center text-ink/40 text-[13px] py-20">Loading…</div>
				) : notFound || !note ? (
					<div className="text-center py-16">
						<p className="text-[16px] font-bold text-ink/70 mb-1.5">Note not found</p>
						<p className="text-[13.5px] text-ink/50 mb-6">{NOT_SHARED_MESSAGE}</p>
						<Link to="/" className="btn-primary px-5 py-2.5 text-[13.5px] no-underline">Go to NoteMind</Link>
					</div>
				) : (
					<>
						<div className="rounded-[20px] border border-ink/15 bg-ink/7 backdrop-blur-[18px] p-5 min-[481px]:p-8">
							<h1 className="text-[22px] font-extrabold mb-1.5 break-words">{note.title}</h1>
							<p className="text-[12px] text-ink/40 mb-5">Shared note · updated {relativeTime(note.updatedAt)}</p>
							<div
								className="note-prose text-[14.5px] text-ink/75"
								dangerouslySetInnerHTML={{__html: safeHtml}}
							/>
							{note.tags.length > 0 && (
								<div className="flex flex-wrap gap-1.5 mt-5 pt-5 border-t border-ink/10">
									{note.tags.map((t) => (
										<span key={t} className="bg-accent/20 text-accent text-[11px] py-[3px] px-2.5 rounded-full">{t}</span>
									))}
								</div>
							)}
						</div>

						{/* The growth loop this page exists for — see the file comment. */}
						<div className="mt-6 rounded-[16px] border border-accent/25 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-accent)_14%,transparent),color-mix(in_srgb,var(--color-growth)_10%,transparent))] p-5 min-[481px]:p-6 text-center">
							{user ? (
								<>
									<p className="text-[14px] font-bold mb-1">Shared from NoteMind</p>
									<p className="text-[12.5px] text-ink/55 mb-4">You're already signed in — head back to your own notes any time.</p>
									<Link to="/dashboard" className="btn-primary px-6 py-2.5 text-[13.5px] no-underline">Open my notes</Link>
								</>
							) : (
								<>
									<p className="text-[14px] font-bold mb-1">This note was shared from NoteMind</p>
									<p className="text-[12.5px] text-ink/55 mb-4">Free AI-powered notes, flashcards, and a graph of how your ideas connect — no card required.</p>
									<Link to="/register" className="btn-primary px-6 py-2.5 text-[13.5px] no-underline">Create your free account</Link>
								</>
							)}
						</div>
					</>
				)}
			</main>

			<footer className="border-t border-ink/10">
				<div className="max-w-[720px] w-full mx-auto px-5 py-6 flex items-center justify-between gap-4">
					<Logo size={18} textSize="text-[14px]" />
					<nav className="flex items-center gap-4 text-[12px]">
						<Link to="/privacy" className="text-ink/45 hover:text-ink no-underline">Privacy</Link>
						<Link to="/terms" className="text-ink/45 hover:text-ink no-underline">Terms</Link>
					</nav>
				</div>
			</footer>
		</div>
	)
}

export default Share
