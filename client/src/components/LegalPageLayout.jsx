import {Link} from 'react-router-dom'
import Logo from './Logo'

// Shared chrome for /privacy and /terms — the only two pages in the app
// whose content is prose rather than product UI. Kept as one layout so the
// two documents can't visually drift apart from each other.
function LegalPageLayout({title, updated, children}) {
	return (
		<div className="min-h-screen flex flex-col">
			<header className="max-w-[820px] w-full mx-auto px-5 py-6">
				<Link to="/" className="no-underline"><Logo size={26} textSize="text-[22px]" /></Link>
			</header>
			<main className="flex-1 max-w-[820px] w-full mx-auto px-5 pb-20">
				<div className="rounded-[20px] border border-ink/15 bg-ink/7 backdrop-blur-[18px] p-6 min-[640px]:p-10">
					<h1 className="text-[28px] font-extrabold mb-1.5">{title}</h1>
					<p className="text-ink/45 text-[13px] mb-8">Last updated {updated}</p>
					<div className="flex flex-col gap-6 text-[14.5px] leading-relaxed text-ink/75 [&_h2]:text-[17px] [&_h2]:font-bold [&_h2]:text-ink [&_h2]:mt-2 [&_h2]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5 [&_a]:text-accent [&_strong]:text-ink [&_strong]:font-semibold">
						{children}
					</div>
				</div>
				<p className="text-center mt-6">
					<Link to="/" className="text-ink/45 hover:text-ink no-underline text-sm">← Back to home</Link>
				</p>
			</main>
		</div>
	)
}

export default LegalPageLayout
