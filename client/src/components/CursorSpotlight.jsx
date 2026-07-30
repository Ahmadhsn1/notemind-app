import {useEffect, useRef} from 'react'

// A soft glow that follows the cursor across the dashboard — reinforces the
// "alive" feel of the Momentum redesign without being distracting. Skipped
// entirely for touch/coarse-pointer devices and reduced-motion preference,
// since it's pure ambience with no functional purpose.
function CursorSpotlight() {
	const ref = useRef(null)

	useEffect(() => {
		const el = ref.current
		if (!el) return
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
		if (!window.matchMedia('(hover: hover)').matches) return

		const handleMove = (e) => {
			el.style.setProperty('--sx', `${e.clientX}px`)
			el.style.setProperty('--sy', `${e.clientY}px`)
			el.style.opacity = '1'
		}
		const handleLeave = () => { el.style.opacity = '0' }

		document.addEventListener('mousemove', handleMove)
		document.addEventListener('mouseleave', handleLeave)
		return () => {
			document.removeEventListener('mousemove', handleMove)
			document.removeEventListener('mouseleave', handleLeave)
		}
	}, [])

	return (
		<div
			ref={ref}
			aria-hidden="true"
			className="fixed inset-0 z-0 pointer-events-none transition-opacity duration-500 opacity-0"
			style={{background: 'radial-gradient(420px circle at var(--sx,50%) var(--sy,30%), color-mix(in srgb, var(--color-accent) 12%, transparent), transparent 72%)'}}
		/>
	)
}

export default CursorSpotlight
