import {Link} from 'react-router-dom'
import Logo from '../components/Logo'

// Public marketing page at "/" — the only page in the app a logged-out
// visitor and a search/ad crawler can actually reach without an account.
// Everything else (Dashboard, GraphView, Account, Admin) sits behind auth,
// so this page — plus Privacy/Terms — is deliberately where the app's whole
// public-facing footprint lives. Kept as a plain server-renderable-looking
// page (no data fetching, no auth check) on purpose.
const FEATURES = [
	{
		title: 'AI that reads your notes',
		body: 'Ask questions across every note you\'ve written and get a real answer with sources — not just a keyword search.',
	},
	{
		title: 'Auto-tagging & titles',
		body: 'Gemini suggests tags and titles as you write, so notes stay organized without extra busywork.',
	},
	{
		title: 'Spaced-repetition flashcards',
		body: 'Turn any note into a flashcard deck and review it on a schedule built to make it stick.',
	},
	{
		title: 'Wikilink graph view',
		body: '[[Link]] notes to each other and see how your thinking connects in a live, explorable graph.',
	},
	{
		title: 'Version history',
		body: 'Every edit is recoverable — restore an older version of a note in one click, no data ever silently lost.',
	},
	{
		title: 'Works offline',
		body: 'Installable as an app on desktop or mobile, with offline reading built in.',
	},
]

function Landing() {
	return (
		<div className="min-h-screen flex flex-col">
			<header className="flex items-center justify-between max-w-[1100px] w-full mx-auto px-5 py-6">
				<Logo size={28} textSize="text-[24px]" />
				<nav className="flex items-center gap-3">
					<Link to="/login" className="text-ink/70 hover:text-ink no-underline text-sm font-medium">Login</Link>
					<Link to="/register" className="btn-primary px-4 py-2 text-sm no-underline">Get started free</Link>
				</nav>
			</header>

			<main className="flex-1">
				<section className="max-w-[820px] w-full mx-auto px-5 pt-12 pb-16 text-center">
					<h1 className="text-[clamp(32px,6vw,52px)] font-extrabold leading-[1.1] mb-5">
						Your thoughts, organized <span className="bg-gradient-to-r from-accent to-growth bg-clip-text text-transparent">and alive</span>
					</h1>
					<p className="text-[17px] text-ink/60 max-w-[560px] mx-auto mb-9">
						NoteMind is a free note-taking app with AI built in — auto-tagging, cross-note Q&amp;A,
						spaced-repetition flashcards, and a graph view of how your notes connect.
					</p>
					<div className="flex items-center justify-center gap-3 flex-wrap">
						<Link to="/register" className="btn-primary px-7 py-3.5 text-[15px] no-underline">Create a free account</Link>
						<Link to="/login" className="rounded-[10px] border border-ink/15 px-7 py-3.5 text-[15px] font-semibold text-ink no-underline hover:bg-ink/8 transition-colors">
							Login
						</Link>
					</div>
					<p className="text-ink/40 text-[13px] mt-4">No credit card. No trial. Free, full-featured, forever.</p>
				</section>

				<section className="max-w-[1100px] w-full mx-auto px-5 pb-20">
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
						{FEATURES.map((f) => (
							<div key={f.title} className="rounded-[16px] border border-ink/12 bg-ink/6 p-6">
								<h3 className="text-[16px] font-bold mb-2">{f.title}</h3>
								<p className="text-[14px] text-ink/55 leading-relaxed">{f.body}</p>
							</div>
						))}
					</div>
				</section>
			</main>

			<footer className="border-t border-ink/10">
				<div className="max-w-[1100px] w-full mx-auto px-5 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[13px] text-ink/45">
					<p>© {new Date().getFullYear()} NoteMind. All rights reserved.</p>
					<nav className="flex items-center gap-5">
						<Link to="/privacy" className="text-ink/45 hover:text-ink no-underline">Privacy Policy</Link>
						<Link to="/terms" className="text-ink/45 hover:text-ink no-underline">Terms of Service</Link>
						<a href="mailto:notemind.ai.app@gmail.com" className="text-ink/45 hover:text-ink no-underline">Contact</a>
					</nav>
				</div>
			</footer>
		</div>
	)
}

export default Landing
