import {Link} from 'react-router-dom'
import Logo from '../components/Logo'
import {useAuth} from '../context/AuthContext'
import {ICONS} from '../components/icons/marketingIcons'

const Icon = ({path, className = ''}) => (
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
		{path}
	</svg>
)

// Public, unauthenticated route (see App.jsx) — a pre-signup decision page,
// not an in-app reference the way Features.jsx/WhatsNew.jsx are: it answers
// "is this for someone like me?" for a visitor who hasn't joined yet, so
// it's linked from Landing.jsx/Features.jsx but deliberately NOT added to
// Sidebar.jsx/Account.jsx (see the plan's reasoning — no benefit to an
// existing user, just sidebar clutter).
//
// Two audiences, students given first position and the section-intro
// framing weight — an explicit product decision (2026-08-18, see the
// mission/target-audience memory) made after real market research, not
// guessed: students have the strongest evidence and the most
// vertical-specific feature (flashcards), knowledge workers/researchers are
// an equally real second audience.
//
// Deliberately avoids "second brain"/"PKM"/graph-first language anywhere on
// this page — that framing has a real, repeatedly documented backlash (see
// the same memory) even though the wikilink graph is a genuine shipped
// feature (it's covered, without leading with it, on Features.jsx).
// Copy also avoids citing specific percentages/statistics — the research
// behind this page's framing is directional, not something to overclaim on
// a live public page.

const SectionHeading = ({eyebrow, title, sub}) => (
	<div className="max-w-[620px] mb-8">
		<p className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-accent mb-2.5">{eyebrow}</p>
		<h2 className="text-[clamp(22px,3.5vw,30px)] font-extrabold leading-[1.2] mb-2.5">{title}</h2>
		{sub && <p className="text-[14.5px] text-ink/55 leading-relaxed">{sub}</p>}
	</div>
)

const UseCaseCard = ({icon, title, body}) => (
	<div className="rounded-[14px] border border-ink/12 bg-ink/5 p-5 transition-colors hover:border-accent/30 hover:bg-ink/8">
		<div className="w-9 h-9 rounded-[10px] bg-accent/14 border border-accent/22 flex items-center justify-center mb-3.5">
			<Icon path={icon} className="w-[18px] h-[18px] text-accent" />
		</div>
		<h3 className="text-[14.5px] font-bold mb-1.5">{title}</h3>
		<p className="text-[13px] text-ink/55 leading-relaxed">{body}</p>
	</div>
)

const SECTIONS = [
	{
		eyebrow: 'Study smarter',
		title: 'From lecture notes to exam-ready — without switching apps',
		sub: 'Stop juggling a notes app, a flashcard app, and a search bar that never finds the right page.',
		items: [
			{icon: ICONS.cards, title: 'Turn today\'s notes into tomorrow\'s quiz', body: 'Generate spaced-repetition flashcards from any note in one click — no manual card-writing, no separate app to keep in sync.'},
			{icon: ICONS.sparkles, title: 'Ask instead of re-reading', body: 'The night before an exam, ask what you wrote about a topic and get an answer pulled straight from your own notes, with the source cited — not a wall of pages to scroll back through.'},
			{icon: ICONS.search, title: 'Never lose track of a semester', body: 'A folder per class, tags per topic, and search that finds a note by what it means — not just the exact words you happened to use when you wrote it.'},
		],
	},
	{
		eyebrow: 'Think for a living',
		title: 'Everything you\'ve read and thought, actually findable',
		sub: 'Notes are only useful if you can get back to them later — and get an answer, not just a list of pages to reread.',
		items: [
			{icon: ICONS.sparkles, title: 'Ask across everything you\'ve written', body: 'Query weeks or months of meeting notes, reading, and research in one place, and get a synthesized, cited answer instead of scrolling through all of it yourself.'},
			{icon: ICONS.search, title: 'Find it by meaning, not the exact word', body: 'Semantic search surfaces the note about a conversation even if you never typed the specific word you\'re searching for now.'},
			{icon: ICONS.link, title: 'Hand off a note without the whole workspace', body: 'Share a single note as a read-only public link — no account needed for whoever you send it to, and you can turn it off any time.'},
		],
	},
]

function UseCases() {
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
						Built for how you actually <span className="bg-gradient-to-r from-accent to-growth bg-clip-text text-transparent">study and work</span>
					</h1>
					<p className="text-[15px] text-ink/55 leading-relaxed max-w-[520px] mx-auto">
						Two ways people use NoteMind every day — see which one sounds like you.
					</p>
				</section>

				<div className="max-w-[1120px] w-full mx-auto px-5 pb-16 flex flex-col gap-16">
					{SECTIONS.map((sec) => (
						<section key={sec.title}>
							<SectionHeading eyebrow={sec.eyebrow} title={sec.title} sub={sec.sub} />
							<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
								{sec.items.map((item) => <UseCaseCard key={item.title} {...item} />)}
							</div>
						</section>
					))}
				</div>

				<section className="max-w-[1120px] w-full mx-auto px-5 pb-20">
					<div className="relative overflow-hidden rounded-[20px] border border-accent/25 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-accent)_16%,transparent),color-mix(in_srgb,var(--color-growth)_12%,transparent))] px-6 py-14 text-center">
						{user ? (
							<>
								<h2 className="text-[clamp(22px,3.5vw,30px)] font-extrabold leading-[1.15] mb-4">Sounds like you? You're already set up for it.</h2>
								<p className="text-[14.5px] text-ink/60 max-w-[440px] mx-auto mb-8">Everything above is already in your account — nothing extra to turn on.</p>
								<Link to="/dashboard" className="btn-primary px-8 py-3.5 text-[15px] no-underline">Back to your notes</Link>
							</>
						) : (
							<>
								<h2 className="text-[clamp(22px,3.5vw,30px)] font-extrabold leading-[1.15] mb-4">Sounds like you?</h2>
								<p className="text-[14.5px] text-ink/60 max-w-[440px] mx-auto mb-8">Free, from the first note — no tier, no trial, no card.</p>
								<Link to="/register" className="btn-primary px-8 py-3.5 text-[15px] no-underline">Create your free account</Link>
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
						<Link to="/features" className="text-ink/45 hover:text-ink no-underline">Features</Link>
						<Link to="/whats-new" className="text-ink/45 hover:text-ink no-underline">What's new</Link>
						<Link to="/privacy" className="text-ink/45 hover:text-ink no-underline">Privacy</Link>
						<Link to="/terms" className="text-ink/45 hover:text-ink no-underline">Terms</Link>
					</nav>
				</div>
			</footer>
		</div>
	)
}

export default UseCases
