import {useEffect, useRef} from 'react'

const FOCUSABLE_SELECTOR =
	'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Shared focus-trap + focus-restore + Escape-to-close for every "fixed
// inset-0" overlay dialog in the app (~12 of them — previously each either
// had none of this or, in a few, had hand-rolled Escape-only handling with
// no focus trap or restore). One hook applied the same way everywhere
// rather than patching each dialog differently, so the behavior — and any
// future fix to it — stays identical across all of them.
//
// `panelRef` must point at the dialog's own card/panel element, not the
// backdrop: Tab is trapped to focusable descendants of it, and it's the
// fallback focus target for panels with no better candidate (an
// `<input autoFocus>`, where a dialog already has one, wins on its own —
// the browser applies autofocus during commit, before this effect's passive
// effect runs, so the `contains` check below sees it and leaves it alone).
//
// Effect deps are deliberately just [isOpen], not onClose/panelRef too —
// onClose is a fresh inline closure on most call sites, and re-running this
// effect on every parent re-render (not just open/close) would tear down
// and rebuild the focus trap mid-keystroke, yanking focus out of whatever
// field the user is actively typing in. onClose's *behavior* ("close this
// dialog") doesn't meaningfully change between a dialog's own renders, so
// capturing it once per open is correct, not stale.
function useModalA11y(isOpen, onClose, panelRef) {
	const previouslyFocusedRef = useRef(null)

	useEffect(() => {
		if (!isOpen) return undefined

		previouslyFocusedRef.current = document.activeElement

		const panel = panelRef.current
		if (panel && !panel.contains(document.activeElement)) {
			const firstFocusable = panel.querySelector(FOCUSABLE_SELECTOR)
			;(firstFocusable || panel).focus({preventScroll: true})
		}

		const handleKeyDown = (e) => {
			if (e.key === 'Escape') {
				onClose()
				return
			}
			if (e.key !== 'Tab' || !panelRef.current) return

			const focusable = Array.from(panelRef.current.querySelectorAll(FOCUSABLE_SELECTOR))
				.filter((el) => el.offsetParent !== null)
			if (focusable.length === 0) return

			const first = focusable[0]
			const last = focusable[focusable.length - 1]
			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault()
				last.focus()
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault()
				first.focus()
			}
		}

		document.addEventListener('keydown', handleKeyDown)
		return () => {
			document.removeEventListener('keydown', handleKeyDown)
			// Restore focus to whatever opened the dialog — but only if focus is
			// still ours to give back. One dialog closing while another opens in
			// the same render (e.g. TemplatePickerModal -> NoteFormModal) runs
			// this cleanup *after* the new dialog's own effect has already run
			// and after the browser has already applied its <input autoFocus>;
			// restoring unconditionally here would yank focus back off of that
			// input and onto whatever opened the first dialog. `panel` (captured
			// above, not read fresh from panelRef.current which React may have
			// already nulled out by now) still correctly answers "is focus still
			// somewhere inside me" even once detached.
			if (panel && !panel.contains(document.activeElement)) return
			const toRestore = previouslyFocusedRef.current
			if (toRestore && document.contains(toRestore) && typeof toRestore.focus === 'function') {
				toRestore.focus({preventScroll: true})
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- see comment above
	}, [isOpen])
}

export default useModalA11y
