// The app's mark: an open ring, indigo fading to teal-green (the same
// gradient/shape as the review-streak ring on the Dashboard — see
// MomentumHero.jsx) with a small glowing node at the "growth" end. Rendered
// inline as SVG (not <img src="/favicon.svg">) so it inherits no caching
// quirks and can be sized/reused anywhere without an extra network request.
function LogoMark({size = 22, glow = true}) {
	return (
		<svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
			<defs>
				<linearGradient id="logoRingGrad" gradientUnits="userSpaceOnUse" x1="78.19" y1="60.26" x2="60.26" y2="21.81">
					<stop offset="0%" stopColor="var(--color-accent)" />
					<stop offset="100%" stopColor="var(--color-growth)" />
				</linearGradient>
				{glow && (
					<filter id="logoDotGlow" x="-100%" y="-100%" width="300%" height="300%">
						<feGaussianBlur stdDeviation="4" result="blur" />
						<feMerge>
							<feMergeNode in="blur" />
							<feMergeNode in="SourceGraphic" />
						</feMerge>
					</filter>
				)}
			</defs>
			<path
				d="M 78.19 60.26 A 30 30 0 1 1 60.26 21.81"
				fill="none"
				stroke="url(#logoRingGrad)"
				strokeWidth="12"
				strokeLinecap="round"
			/>
			<circle cx="60.26" cy="21.81" r="6.4" fill="var(--color-growth)" filter={glow ? 'url(#logoDotGlow)' : undefined} />
		</svg>
	)
}

function Logo({size = 22, textSize = 'text-[19px]', className = ''}) {
	return (
		<div className={`flex items-center gap-2 ${className}`}>
			<LogoMark size={size} />
			<span className={`${textSize} font-bold bg-gradient-to-r from-accent to-growth bg-clip-text text-transparent`}>NoteMind</span>
		</div>
	)
}

export { LogoMark }
export default Logo
