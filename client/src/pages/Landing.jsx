import {Link} from 'react-router-dom'
import Logo from '../components/Logo'

// Public marketing page at "/" — the only page in the app a logged-out
// visitor and a search crawler can actually reach without an account.
// Everything else (Dashboard, GraphView, Account, Admin) sits behind auth,
// so this page — plus Privacy/Terms — is deliberately the app's whole
// public-facing footprint. No data fetching and no auth check on purpose.
//
// The "free" framing throughout is load-bearing, not decoration: a notes app
// asking for your private thinking has to answer "why is this free?" before
// anything else, or free reads as cheap/untrustworthy rather than generous.
// That's what the Promise and FAQ sections exist for — don't strip them back
// to a plain feature list.

const Icon = ({path, className = ''}) => (
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
		{path}
	</svg>
)

const ICONS = {
	// Two four-point stars. An earlier version drew four separate radiating
	// strokes plus a small diamond, which at 14–20px just read as a plus sign.
	sparkles: <><path d="M10.5 3l1.7 4.8L17 9.5l-4.8 1.7L10.5 16l-1.7-4.8L4 9.5l4.8-1.7z" /><path d="M17.5 14l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z" /></>,
	tag: <><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2A2 2 0 0 1 3 12V4a1 1 0 0 1 1-1h8a2 2 0 0 1 1.4.6l7.2 7.2a2 2 0 0 1 0 2.6Z" /><circle cx="7.5" cy="7.5" r="1.2" /></>,
	cards: <><rect x="3" y="7" width="13" height="14" rx="2" /><path d="M8 3h11a2 2 0 0 1 2 2v11" /></>,
	graph: <><circle cx="6" cy="7" r="2.5" /><circle cx="18" cy="7" r="2.5" /><circle cx="12" cy="18" r="2.5" /><path d="M8 8.5 10.5 16M16 8.5 13.5 16M8.5 7h7" /></>,
	history: <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v4h4" /><path d="M12 8v4l3 2" /></>,
	offline: <><path d="M12 3v12" /><path d="M8 11l4 4 4-4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></>,
	check: <path d="m5 13 4 4L19 7" />,
	shield: <><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /><path d="m9 12 2 2 4-4" /></>,
	lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
	download: <><path d="M12 3v12" /><path d="m7 11 5 4 5-4" /><path d="M4 20h16" /></>,
	noAds: <><circle cx="12" cy="12" r="9" /><path d="m5.6 5.6 12.8 12.8" /></>,
}

const FEATURES = [
	{
		icon: ICONS.sparkles,
		title: 'Ask your notes anything',
		body: 'Not keyword search — a real answer, written from what you actually wrote, with the source notes cited. Ask "what did I decide about the API redesign?" and get the decision back.',
	},
	{
		icon: ICONS.tag,
		title: 'Organizes itself',
		body: 'Tags and titles suggested as you type. Semantic search that finds the note you meant, not the note that happened to share a word with your query.',
	},
	{
		icon: ICONS.cards,
		title: 'Notes that become memory',
		body: 'Turn any note into a flashcard deck in one click, then review on an SM-2 spaced-repetition schedule built to make things actually stick.',
	},
	{
		icon: ICONS.graph,
		title: 'See how your ideas connect',
		body: 'Write [[wikilinks]] between notes and watch a live force-directed graph of your own thinking assemble itself.',
	},
	{
		icon: ICONS.history,
		title: 'Nothing is ever lost',
		body: 'Every edit is versioned and restorable. Trash is recoverable. Restoring an old version is itself undoable — because notes are not the place for one-way doors.',
	},
	{
		icon: ICONS.offline,
		title: 'Yours on every device',
		body: 'Install it like a native app on desktop or phone. Your notes stay readable offline, and a full export is always one click away.',
	},
]

const PROMISES = [
	{icon: ICONS.check, title: 'Every feature, unlocked', body: 'No Pro tier. No "upgrade to continue". The AI, the flashcards, the graph — all of it, from your first note.'},
	{icon: ICONS.noAds, title: 'No ads, ever', body: 'Not in your notes, not anywhere. Your private thinking is not ad inventory.'},
	{icon: ICONS.lock, title: 'No credit card', body: 'There is no card field, because there is nothing to charge. Sign up in about ten seconds.'},
	{icon: ICONS.download, title: 'Your data, genuinely yours', body: 'Export every note as JSON or Markdown whenever you like. Delete your account and it is really gone.'},
]

const FAQS = [
	{
		q: 'Is it actually free, or free-for-now?',
		a: 'Actually free. There is no paid plan to graduate you into and no feature switched off behind a price. If that ever changes for any part of NoteMind, it will be announced clearly and in advance — never applied quietly to something you already rely on.',
	},
	{
		q: 'Then what is the catch?',
		a: 'There is no ad business and no data business here. NoteMind is built as a real product, kept free, and paid for by other work — which is exactly why the free version is the whole product rather than a sample of it.',
	},
	{
		q: 'Does the AI read my private notes?',
		a: 'Only the notes relevant to the specific thing you asked for, only at the moment you ask, and only to generate that one response. Nothing is used to train anything. The Privacy Policy names every service involved and what each one sees.',
	},
	{
		q: 'Can I get my notes out again?',
		a: 'Any time, in one click — a full JSON dump of every field, or a zip of readable Markdown files. Including archived and trashed notes, so it is a genuine backup rather than a snapshot of the current view.',
	},
]

const SectionHeading = ({eyebrow, title, sub}) => (
	<div className="text-center max-w-[620px] mx-auto mb-12">
		<p className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-accent mb-3">{eyebrow}</p>
		<h2 className="text-[clamp(24px,4vw,34px)] font-extrabold leading-[1.15] mb-3.5">{title}</h2>
		{sub && <p className="text-[15px] text-ink/55 leading-relaxed">{sub}</p>}
	</div>
)

// A stylised, non-interactive impression of the real app — real copy rather
// than skeleton placeholder bars, because this is the first and often only
// thing a visitor actually looks at: grey bars read as an unfinished product,
// while legible content shows what NoteMind does before they read a word of
// the sections below. Hand-built rather than a screenshot so it can't go
// stale every time the real UI shifts. Decorative, hence aria-hidden.
const PREVIEW_FOLDERS = ['All notes', 'Research', 'Product', 'Journal', 'Reading list']

const AppPreview = () => (
	<div aria-hidden="true" className="relative mx-auto w-full max-w-[880px] select-none">
		<div className="absolute -inset-x-10 -top-12 bottom-4 bg-[radial-gradient(ellipse_at_center,color-mix(in_srgb,var(--color-accent)_25%,transparent),transparent_70%)] blur-3xl" />
		<div className="relative rounded-[16px] border border-ink/15 bg-[linear-gradient(180deg,var(--color-panel-a),var(--color-panel-b))] overflow-hidden shadow-[0_40px_90px_-25px_rgba(0,0,0,0.6)] text-left">
			{/* Window chrome + a fake command palette hint */}
			<div className="flex items-center gap-2 px-4 py-3 border-b border-ink/10">
				<span className="w-2.5 h-2.5 rounded-full bg-danger-light/50" />
				<span className="w-2.5 h-2.5 rounded-full bg-amber/50" />
				<span className="w-2.5 h-2.5 rounded-full bg-growth/50" />
				<div className="ml-3 flex items-center gap-2 px-2.5 py-1 rounded-md bg-ink/8 border border-ink/10 text-[10.5px] text-ink/35">
					<span>Search or ask anything</span>
					<span className="px-1 py-px rounded bg-ink/10 border border-ink/10 font-semibold">⌘K</span>
				</div>
			</div>

			<div className="flex">
				<div className="hidden sm:flex flex-col gap-0.5 w-[176px] shrink-0 p-3 border-r border-ink/10">
					{PREVIEW_FOLDERS.map((f, i) => (
						<div
							key={f}
							className={`px-2.5 py-1.5 rounded-lg text-[11.5px] ${i === 0 ? 'bg-accent/16 border border-accent/25 text-accent font-semibold' : 'text-ink/45'}`}
						>
							{f}
						</div>
					))}
					<div className="mt-auto flex items-center gap-2 px-2.5 py-2 rounded-lg bg-growth/10 border border-growth/22">
						<Icon path={ICONS.cards} className="w-3.5 h-3.5 text-growth shrink-0" />
						<span className="text-[11px] font-semibold text-growth">8 cards due</span>
					</div>
				</div>

				<div className="flex-1 p-5 flex flex-col gap-3.5 min-w-0">
					<div className="flex items-start justify-between gap-3">
						<h3 className="text-[15.5px] font-bold leading-snug">Vector search vs. keyword retrieval</h3>
						<span className="shrink-0 text-[9.5px] font-bold px-2 py-1 rounded-full bg-accent/16 text-accent border border-accent/25 whitespace-nowrap">AI tagged</span>
					</div>
					<div className="flex flex-wrap gap-1.5">
						{['research', 'retrieval', 'q3-plan'].map((t) => (
							<span key={t} className="text-[10.5px] px-2 py-0.5 rounded-full bg-ink/8 text-ink/50 border border-ink/10">{t}</span>
						))}
					</div>
					<p className="text-[12.5px] text-ink/45 leading-relaxed">
						Embeddings win when the wording differs but the meaning matches — asking about
						&ldquo;switching costs&rdquo; should still surface the note that only ever said{' '}
						<span className="text-accent/80 underline decoration-accent/30 decoration-dotted">[[lock-in]]</span>.
						Keyword search stays useful as the cheap fallback when a note has no embedding yet.
					</p>

					<div className="mt-1 rounded-[12px] border border-growth/30 bg-growth/8 p-3.5">
						<div className="flex items-center gap-2 mb-2">
							<Icon path={ICONS.sparkles} className="w-3.5 h-3.5 text-growth shrink-0" />
							<span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-growth">Answer from your notes</span>
						</div>
						<p className="text-[12.5px] text-ink/65 leading-relaxed mb-2.5">
							You decided to keep both: semantic retrieval first, keyword scoring as the
							fallback — so a note still turns up even when its embedding hasn't been built.
						</p>
						<div className="flex flex-wrap items-center gap-1.5">
							<span className="text-[10px] text-ink/35">Sources</span>
							{['Vector search vs. keyword retrieval', 'Q3 planning'].map((s) => (
								<span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-ink/8 text-ink/50 border border-ink/10 truncate max-w-[180px]">{s}</span>
							))}
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
)

function Landing() {
	return (
		<div className="min-h-screen flex flex-col overflow-x-hidden">
			<header className="sticky top-0 z-20 border-b border-ink/8 bg-ink-deep/70 backdrop-blur-xl">
				<div className="flex items-center justify-between max-w-[1120px] w-full mx-auto px-5 py-3.5">
					<Logo size={26} textSize="text-[21px]" />
					<nav className="flex items-center gap-2.5">
						<Link to="/login" className="text-ink/65 hover:text-ink no-underline text-[13.5px] font-medium px-2.5 py-2">Login</Link>
						<Link to="/register" className="btn-primary px-4 py-2 text-[13.5px] no-underline whitespace-nowrap">Start free</Link>
					</nav>
				</div>
			</header>

			<main className="flex-1">
				{/* Hero */}
				<section className="relative max-w-[1120px] w-full mx-auto px-5 pt-16 pb-14 text-center">
					<span className="inline-flex items-center gap-2 rounded-full border border-growth/30 bg-growth/10 px-3.5 py-1.5 text-[12px] font-semibold text-growth mb-7">
						<Icon path={ICONS.check} className="w-3.5 h-3.5" />
						Free — every feature, no credit card
					</span>
					<h1 className="text-[clamp(34px,7vw,60px)] font-extrabold leading-[1.05] tracking-[-0.02em] mb-6 max-w-[860px] mx-auto">
						Notes that <span className="bg-gradient-to-r from-accent to-growth bg-clip-text text-transparent">think with you</span>
					</h1>
					<p className="text-[clamp(15px,2vw,18px)] text-ink/60 leading-relaxed max-w-[580px] mx-auto mb-9">
						Write it down once, then ask your notes questions and get real answers.
						NoteMind adds AI, spaced-repetition memory, and a living map of your ideas
						to the notes you already take — with nothing held back behind a price.
					</p>
					<div className="flex items-center justify-center gap-3 flex-wrap mb-4">
						<Link to="/register" className="btn-primary px-7 py-3.5 text-[15px] no-underline">Create your free account</Link>
						<Link to="/login" className="rounded-[10px] border border-ink/15 px-7 py-3.5 text-[15px] font-semibold text-ink no-underline hover:bg-ink/8 transition-colors">
							I already have one
						</Link>
					</div>
					<p className="text-ink/40 text-[12.5px] mb-16">Takes about ten seconds · No card · Export or delete everything any time</p>

					<AppPreview />
				</section>

				{/* Features */}
				<section className="max-w-[1120px] w-full mx-auto px-5 py-16">
					<SectionHeading
						eyebrow="What's inside"
						title="Six things most notes apps make you pay for"
						sub="All of it included, from the first note you write."
					/>
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
						{FEATURES.map((f) => (
							<div key={f.title} className="group rounded-[16px] border border-ink/12 bg-ink/5 p-6 transition-colors hover:border-accent/30 hover:bg-ink/8">
								<div className="w-10 h-10 rounded-[11px] bg-accent/14 border border-accent/22 flex items-center justify-center mb-4">
									<Icon path={f.icon} className="w-5 h-5 text-accent" />
								</div>
								<h3 className="text-[15.5px] font-bold mb-2">{f.title}</h3>
								<p className="text-[13.5px] text-ink/55 leading-relaxed">{f.body}</p>
							</div>
						))}
					</div>
				</section>

				{/* The free promise — the section that makes "free" read as generous. */}
				<section className="border-y border-ink/10 bg-ink/4">
					<div className="max-w-[1120px] w-full mx-auto px-5 py-16">
						<SectionHeading
							eyebrow="The deal"
							title="Free, in the way that word should mean"
							sub="Not a trial. Not a crippled tier waiting to upsell you. The whole product."
						/>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-[820px] mx-auto">
							{PROMISES.map((p) => (
								<div key={p.title} className="flex gap-3.5 rounded-[14px] border border-ink/10 bg-ink/5 p-5">
									<div className="w-8 h-8 shrink-0 rounded-[9px] bg-growth/14 border border-growth/25 flex items-center justify-center">
										<Icon path={p.icon} className="w-4 h-4 text-growth" />
									</div>
									<div>
										<h3 className="text-[14.5px] font-bold mb-1.5">{p.title}</h3>
										<p className="text-[13px] text-ink/55 leading-relaxed">{p.body}</p>
									</div>
								</div>
							))}
						</div>
					</div>
				</section>

				{/* Trust */}
				<section className="max-w-[1120px] w-full mx-auto px-5 py-16">
					<div className="max-w-[720px] mx-auto rounded-[18px] border border-ink/12 bg-ink/5 p-7 min-[640px]:p-9">
						<div className="flex items-center gap-3 mb-5">
							<div className="w-9 h-9 shrink-0 rounded-[10px] bg-accent/14 border border-accent/22 flex items-center justify-center">
								<Icon path={ICONS.shield} className="w-4.5 h-4.5 text-accent" />
							</div>
							<h2 className="text-[19px] font-extrabold">Built for something you'd trust with your thinking</h2>
						</div>
						<ul className="flex flex-col gap-3">
							{[
								'Passwords hashed with bcrypt, never stored or logged in plain text — sign in with Google instead if you prefer.',
								'Every note is scoped to its owner and checked on every single request. There is no shared or public note surface to leak through.',
								'Note content is sanitized on the way in and again on the way out, so pasted markup can never execute.',
								'A full export of everything you own is always one click away in your account settings.',
							].map((line) => (
								<li key={line} className="flex gap-3 text-[13.5px] text-ink/60 leading-relaxed">
									<Icon path={ICONS.check} className="w-4 h-4 mt-0.5 shrink-0 text-growth" />
									<span>{line}</span>
								</li>
							))}
						</ul>
					</div>
				</section>

				{/* FAQ */}
				<section className="max-w-[1120px] w-full mx-auto px-5 pb-16">
					<SectionHeading eyebrow="Straight answers" title="The questions everyone asks first" />
					<div className="max-w-[720px] mx-auto flex flex-col gap-3">
						{FAQS.map((f) => (
							<details key={f.q} className="group rounded-[14px] border border-ink/12 bg-ink/5 px-5 open:bg-ink/8 transition-colors">
								<summary className="flex items-center justify-between gap-4 cursor-pointer list-none py-4.5 text-[14.5px] font-semibold marker:hidden [&::-webkit-details-marker]:hidden">
									{f.q}
									<span className="shrink-0 text-ink/35 text-lg leading-none transition-transform group-open:rotate-45">+</span>
								</summary>
								<p className="text-[13.5px] text-ink/55 leading-relaxed pb-5 -mt-0.5">{f.a}</p>
							</details>
						))}
					</div>
				</section>

				{/* Final CTA */}
				<section className="max-w-[1120px] w-full mx-auto px-5 pb-20">
					<div className="relative overflow-hidden rounded-[20px] border border-accent/25 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-accent)_16%,transparent),color-mix(in_srgb,var(--color-growth)_12%,transparent))] px-6 py-14 text-center">
						<h2 className="text-[clamp(24px,4vw,34px)] font-extrabold leading-[1.15] mb-4">Start with one note.</h2>
						<p className="text-[15px] text-ink/60 max-w-[460px] mx-auto mb-8">
							Everything else — the AI, the flashcards, the graph — is already turned on and waiting for you.
						</p>
						<Link to="/register" className="btn-primary px-8 py-3.5 text-[15px] no-underline">Create your free account</Link>
					</div>
				</section>
			</main>

			<footer className="border-t border-ink/10">
				<div className="max-w-[1120px] w-full mx-auto px-5 py-7 flex flex-col sm:flex-row items-center justify-between gap-4">
					<div className="flex flex-col items-center sm:items-start gap-1.5">
						<Logo size={20} textSize="text-[16px]" />
						<p className="text-[12px] text-ink/40">© {new Date().getFullYear()} NoteMind. All rights reserved.</p>
					</div>
					<nav className="flex items-center gap-5 text-[12.5px]">
						<Link to="/privacy" className="text-ink/45 hover:text-ink no-underline">Privacy</Link>
						<Link to="/terms" className="text-ink/45 hover:text-ink no-underline">Terms</Link>
						<a href="mailto:notemind.ai.app@gmail.com" className="text-ink/45 hover:text-ink no-underline">Contact</a>
					</nav>
				</div>
			</footer>
		</div>
	)
}

export default Landing
