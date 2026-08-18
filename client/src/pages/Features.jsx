import {Link} from 'react-router-dom'
import Logo from '../components/Logo'
import {useAuth} from '../context/AuthContext'
import {ICONS} from '../components/icons/marketingIcons'

const Icon = ({path, className = ''}) => (
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
		{path}
	</svg>
)

// Public, unauthenticated route (see App.jsx) — but unlike Privacy/Terms,
// this one matters just as much to an already-logged-in user: every other
// route in the app redirects a logged-in visitor straight past Landing.jsx
// to /dashboard, so without this page (linked from Sidebar.jsx and
// Account.jsx, not just Landing.jsx) an existing user has no standing place
// to see everything NoteMind does — only /whats-new's *recent changes*.
//
// Deliberately excludes Google Sign-In (built and tested — see googleLink
// tests — but not live until GOOGLE_CLIENT_ID is set at deploy time) and
// every admin-only capability (not a user-facing pitch). Every claim below
// must be a feature that's actually shipped and working today, not
// aspirational — this is a promise page, not a roadmap.

const SectionHeading = ({eyebrow, title, sub}) => (
	<div className="max-w-[620px] mb-8">
		<p className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-accent mb-2.5">{eyebrow}</p>
		<h2 className="text-[clamp(21px,3.2vw,27px)] font-extrabold leading-[1.2] mb-2">{title}</h2>
		{sub && <p className="text-[14px] text-ink/55 leading-relaxed">{sub}</p>}
	</div>
)

const FeatureCard = ({icon, title, body}) => (
	<div className="rounded-[14px] border border-ink/12 bg-ink/5 p-5 transition-colors hover:border-accent/30 hover:bg-ink/8">
		<div className="w-9 h-9 rounded-[10px] bg-accent/14 border border-accent/22 flex items-center justify-center mb-3.5">
			<Icon path={icon} className="w-[18px] h-[18px] text-accent" />
		</div>
		<h3 className="text-[14.5px] font-bold mb-1.5">{title}</h3>
		<p className="text-[13px] text-ink/55 leading-relaxed">{body}</p>
	</div>
)

const CATEGORIES = [
	{
		eyebrow: 'Think faster',
		title: 'AI that actually reads your notes',
		sub: 'Every AI feature works on the notes you\'ve already written — nothing extra to set up.',
		items: [
			{icon: ICONS.sparkles, title: 'Ask your notes', body: 'Ask "what did I decide about the API redesign?" and get a real answer written from what you actually wrote, with the source notes cited — not a keyword search pretending to be one.'},
			{icon: ICONS.tag, title: 'Auto-tagging & titles', body: 'Tags and titles suggested as you write, so a note is organized the moment it\'s saved instead of waiting for you to circle back and tidy it.'},
			{icon: ICONS.search, title: 'Semantic search', body: 'Search by meaning, not just matching words — "trip to portugal" surfaces the note that only ever said "flying to Lisbon." Falls back to keyword search automatically if it ever needs to.'},
			{icon: ICONS.pencil, title: 'Writing assist', body: 'Stuck mid-sentence? Continue writing with one click, in your own voice, picked up exactly where you left off.'},
			{icon: ICONS.mail, title: 'Weekly AI digest', body: 'A warm, specific recap of what you wrote that week — in the app and, if you want it, emailed to you every Monday.'},
			{icon: ICONS.history, title: 'On this day', body: 'A daily resurfaced memory from your own past notes, with an AI reflection prompt tying it to what you\'ve been writing about lately.'},
		],
	},
	{
		eyebrow: 'Stay organized',
		title: 'Find anything in seconds',
		sub: 'Folders, tags, links, and search that all work together — not four separate systems.',
		items: [
			{icon: ICONS.folder, title: 'Folders', body: 'Group notes the way you actually think about them, with a live count next to every folder in the sidebar.'},
			{icon: ICONS.tag, title: 'Click-to-filter tags', body: 'Click any tag — on a card or inside a note — to instantly filter down to it, exactly like folders already work.'},
			{icon: ICONS.pin, title: 'Pin what matters', body: 'Pinned notes stay at the top of your dashboard until you unpin them, no matter how much else you write.'},
			{icon: ICONS.link, title: '[[Wikilinks]] & backlinks', body: 'Link notes to each other as you type, and see what links back to the note you\'re reading — your own web of ideas, built as you go.'},
			{icon: ICONS.graph, title: 'Graph view', body: 'A live, explorable map of every linked note, laid out automatically so you can see how your thinking actually connects.'},
			{icon: ICONS.link, title: 'Bookmarkable notes', body: 'Every note has its own link — bookmark it, and reminder emails jump straight to the exact note that\'s due.'},
			{icon: ICONS.link, title: 'Share a note publicly', body: 'Turn any note into a read-only link anyone can open — no account needed. Turn it off any time and the old link stops working.'},
		],
	},
	{
		eyebrow: 'Remember it',
		title: 'Notes that become memory',
		sub: 'Turn what you\'ve written into something you actually retain, not just store.',
		items: [
			{icon: ICONS.cards, title: 'Spaced-repetition flashcards', body: 'Turn any note into a flashcard deck in one click, reviewed on an SM-2 schedule built to make things genuinely stick.'},
			{icon: ICONS.check, title: 'Due-today queue', body: 'One queue shows every card due across every deck, so review is a single daily habit instead of hunting through notes.'},
			{icon: ICONS.streak, title: 'Streaks', body: 'A running streak for writing and for reviewing — separate counters, because showing up to write and showing up to review are different habits worth tracking on their own.'},
			{icon: ICONS.calendar, title: 'Activity calendar', body: 'See your writing activity at a glance, and jump straight to any day\'s notes from the chart.'},
		],
	},
	{
		eyebrow: 'Never miss it',
		title: 'Stay on top of what matters',
		items: [
			{icon: ICONS.bell, title: 'Reminder emails', body: 'Set a reminder on any note and get emailed the moment it\'s due — not just a badge you might scroll past.'},
			{icon: ICONS.mail, title: 'Weekly digest email', body: 'The same AI recap the in-app widget shows, delivered to your inbox every Monday instead of waiting to be opened.'},
			{icon: ICONS.check, title: 'Your call, always', body: 'Both emails are opt-out any time from Account → Email notifications — on by default because they\'re tied to something you asked for, never cold marketing.'},
		],
	},
	{
		eyebrow: 'Trust it',
		title: 'Your notes, genuinely yours',
		items: [
			{icon: ICONS.download, title: 'Full data export', body: 'Every note, as JSON (every field, for re-import) or Markdown (a readable file per note) — a real backup, not a locked-in format.'},
			{icon: ICONS.history, title: 'Version history', body: 'Every edit is versioned and restorable, and restoring an old version is itself undoable — notes are never a one-way door.'},
			{icon: ICONS.lock, title: 'Delete on your terms', body: 'Delete your account yourself, any time, and it\'s genuinely gone — cascaded through every note, version, and flashcard tied to it.'},
			{icon: ICONS.shield, title: 'Built to be trusted', body: 'Passwords hashed with bcrypt, every note scoped and checked on every request, content sanitized on the way in and out.'},
			{icon: ICONS.noAds, title: 'No ads, ever', body: 'Not in your notes, not anywhere. Your private thinking was never going to be ad inventory here.'},
		],
	},
	{
		eyebrow: 'Wherever you are',
		title: 'One app, every device',
		items: [
			{icon: ICONS.device, title: 'Install it like an app', body: 'Add NoteMind to your home screen or dock on desktop or mobile — no app store required.'},
			{icon: ICONS.offline, title: 'Read offline', body: 'Notes you\'ve already opened stay readable without a connection, so a dead spot doesn\'t mean losing access to your own thinking.'},
			{icon: ICONS.theme, title: 'Light & dark', body: 'Follows your system theme automatically, or set it yourself — every surface in the app, including this page, supports both.'},
		],
	},
]

function Features() {
	const {user} = useAuth()

	return (
		<div className="min-h-screen flex flex-col overflow-x-hidden">
			<header className="sticky top-0 z-20 border-b border-ink/8 bg-ink-deep/70 backdrop-blur-xl">
				<div className="flex items-center justify-between max-w-[1120px] w-full mx-auto px-5 py-3.5">
					<Link to={user ? '/dashboard' : '/'} className="no-underline"><Logo size={26} textSize="text-[21px]" /></Link>
					{user ? (
						<Link to="/dashboard" className="btn-primary px-4 py-2 text-[13.5px] no-underline whitespace-nowrap">Back to your notes</Link>
					) : (
						<nav className="flex items-center gap-2.5">
							<Link to="/login" className="text-ink/65 hover:text-ink no-underline text-[13.5px] font-medium px-2.5 py-2">Login</Link>
							<Link to="/register" className="btn-primary px-4 py-2 text-[13.5px] no-underline whitespace-nowrap">Start free</Link>
						</nav>
					)}
				</div>
			</header>

			<main className="flex-1">
				<section className="max-w-[820px] w-full mx-auto px-5 pt-14 pb-10 text-center">
					<h1 className="text-[clamp(28px,5vw,42px)] font-extrabold leading-[1.1] tracking-[-0.02em] mb-4">
						Everything NoteMind <span className="bg-gradient-to-r from-accent to-growth bg-clip-text text-transparent">does</span>
					</h1>
					<p className="text-[15px] text-ink/55 leading-relaxed max-w-[520px] mx-auto">
						Every feature below is live today and included free — nothing on this page is a preview of something coming later.
					</p>
				</section>

				<div className="max-w-[1120px] w-full mx-auto px-5 pb-16 flex flex-col gap-16">
					{CATEGORIES.map((cat) => (
						<section key={cat.title}>
							<SectionHeading eyebrow={cat.eyebrow} title={cat.title} sub={cat.sub} />
							<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
								{cat.items.map((item) => <FeatureCard key={item.title} {...item} />)}
							</div>
						</section>
					))}
				</div>

				<section className="max-w-[1120px] w-full mx-auto px-5 pb-20">
					<div className="relative overflow-hidden rounded-[20px] border border-accent/25 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-accent)_16%,transparent),color-mix(in_srgb,var(--color-growth)_12%,transparent))] px-6 py-14 text-center">
						{user ? (
							<>
								<h2 className="text-[clamp(22px,3.5vw,30px)] font-extrabold leading-[1.15] mb-4">You already have all of this.</h2>
								<p className="text-[14.5px] text-ink/60 max-w-[440px] mx-auto mb-8">Every feature above is available in your account right now — nothing to unlock.</p>
								<Link to="/dashboard" className="btn-primary px-8 py-3.5 text-[15px] no-underline">Back to your notes</Link>
							</>
						) : (
							<>
								<h2 className="text-[clamp(22px,3.5vw,30px)] font-extrabold leading-[1.15] mb-4">All of it, from your first note.</h2>
								<p className="text-[14.5px] text-ink/60 max-w-[440px] mx-auto mb-8">No tier, no trial, no card. Just create an account.</p>
								<Link to="/register" className="btn-primary px-8 py-3.5 text-[15px] no-underline">Create your free account</Link>
								<p className="mt-4">
									<Link to="/use-cases" className="text-[12.5px] font-semibold text-ink/50 no-underline hover:text-ink/75">Not sure it's for you? See real use cases →</Link>
								</p>
							</>
						)}
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
						<Link to="/use-cases" className="text-ink/45 hover:text-ink no-underline">Use cases</Link>
						<Link to="/whats-new" className="text-ink/45 hover:text-ink no-underline">What's new</Link>
						<Link to="/privacy" className="text-ink/45 hover:text-ink no-underline">Privacy</Link>
						<Link to="/terms" className="text-ink/45 hover:text-ink no-underline">Terms</Link>
					</nav>
				</div>
			</footer>
		</div>
	)
}

export default Features
