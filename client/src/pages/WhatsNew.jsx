import {Link} from 'react-router-dom'
import Logo from '../components/Logo'

// Public, unauthenticated route (see App.jsx) — logged-in users are the
// primary audience (they land straight on /dashboard and would otherwise
// never see the Landing page's feature list at all), but it's public too:
// a running changelog is also a trust signal for a logged-out visitor
// deciding whether to sign up ("this is actively maintained").
//
// Hand-maintained on purpose, not generated from git history — a changelog
// entry is a promise about what changed for the *user*, which commit
// messages aren't written to be. Add a new entry here whenever something
// user-facing ships; newest first.
const ENTRIES = [
	{
		date: 'August 2026',
		tag: 'New',
		title: 'Jump straight to a note from anywhere',
		body: 'Every note now has its own link. Reminder emails open the exact note that\'s due — not just the dashboard — and any note\'s link can be bookmarked or shared with yourself.',
	},
	{
		date: 'August 2026',
		tag: 'New',
		title: 'Filter by tag',
		body: 'Click any tag — on a card or inside a note — to instantly filter your notes down to it, the same way folders already work. Auto-tagging finally has somewhere to lead.',
	},
	{
		date: 'August 2026',
		tag: 'New',
		title: 'Reminder emails',
		body: 'Set a reminder on a note and get emailed the moment it\'s due, not just a badge you might not see. Toggle this off any time from Account → Email notifications.',
	},
	{
		date: 'August 2026',
		tag: 'New',
		title: 'Weekly digest email',
		body: 'A Monday recap of what you wrote that week, emailed to you — the same AI recap the in-app widget already showed, now delivered instead of waiting to be opened.',
	},
	{
		date: 'August 2026',
		tag: 'Fixed',
		title: 'Links and underlined text now save correctly',
		body: 'A bug meant a pasted link or underlined word could silently disappear the next time a note was saved. Existing links/underlines from before this fix aren\'t recoverable, but every note is safe going forward.',
	},
]

const TAG_STYLE = {
	New: 'bg-accent/16 text-accent border-accent/25',
	Fixed: 'bg-growth/16 text-growth border-growth/25',
	Improved: 'bg-amber/16 text-amber border-amber/25',
}

function WhatsNew() {
	return (
		<div className="min-h-screen flex flex-col">
			<header className="max-w-[720px] w-full mx-auto px-5 py-6">
				<Link to="/" className="no-underline"><Logo size={26} textSize="text-[22px]" /></Link>
			</header>
			<main className="flex-1 max-w-[720px] w-full mx-auto px-5 pb-20">
				<h1 className="text-[28px] font-extrabold mb-1.5">What's new</h1>
				<p className="text-ink/50 text-[13px] mb-9">A running list of what's shipped, most recent first.</p>

				<div className="flex flex-col gap-4">
					{ENTRIES.map((e, i) => (
						<div key={i} className="rounded-[16px] border border-ink/12 bg-ink/5 p-5 min-[640px]:p-6">
							<div className="flex items-center gap-2.5 mb-2.5">
								<span className={`text-[10.5px] font-bold uppercase tracking-[0.05em] py-[3px] px-2.5 rounded-full border ${TAG_STYLE[e.tag]}`}>{e.tag}</span>
								<span className="text-[11.5px] text-ink/40">{e.date}</span>
							</div>
							<h2 className="text-[16px] font-bold mb-1.5">{e.title}</h2>
							<p className="text-[13.5px] text-ink/60 leading-relaxed">{e.body}</p>
						</div>
					))}
				</div>
			</main>
		</div>
	)
}

export default WhatsNew
