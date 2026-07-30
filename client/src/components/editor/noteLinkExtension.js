import Mention from '@tiptap/extension-mention'
import {ReactRenderer} from '@tiptap/react'
import {computePosition, offset, flip, shift} from '@floating-ui/dom'
import NoteLinkList from './NoteLinkList'

const positionElement = (element, getRect) => {
	const virtualEl = {getBoundingClientRect: getRect}
	computePosition(virtualEl, element, {
		placement: 'bottom-start',
		middleware: [offset(6), flip(), shift({padding: 8})],
	}).then(({x, y}) => {
		Object.assign(element.style, {left: `${x}px`, top: `${y}px`})
	})
}

const MAX_RESULTS = 8

// linkableNotesRef: a ref (owned by NoteEditor) holding {notes, excludeId} —
// live note list to search against, minus the note currently being edited
// (no self-links). Same ref-for-live-data pattern as slash commands'
// aiContinueRef, since this extension is instantiated once but needs fresh
// data on every keystroke, long after that render has passed.
export function createNoteLinkExtension(linkableNotesRef) {
	return Mention.extend({name: 'noteLink'}).configure({
		HTMLAttributes: {},
		// Mention's own parseHTML (unchanged by .extend here) looks for
		// span[data-type="${this.name}"] — this must render that same value
		// ("noteLink") for saved notes to parse back into a link node instead
		// of plain text when reopened. Server-side sanitization/extraction
		// only care about the data-note-id attribute, not this value.
		renderHTML({node}) {
			return ['span', {'data-type': 'noteLink', 'data-note-id': node.attrs.id}, node.attrs.label ?? '']
		},
		renderText({node}) {
			return node.attrs.label ?? ''
		},
		suggestion: {
			char: '[[',
			command: ({editor, range, props}) => {
				editor.chain().focus().insertContentAt(range, [
					{type: 'noteLink', attrs: {id: props.id, label: props.title}},
					{type: 'text', text: ' '},
				]).run()
			},
			items: ({query}) => {
				const {notes = [], excludeId} = linkableNotesRef.current || {}
				const q = query.toLowerCase()
				return notes
					.filter((n) => n._id !== excludeId && n.title.toLowerCase().includes(q))
					.slice(0, MAX_RESULTS)
					.map((n) => ({id: n._id, title: n.title}))
			},
			render: () => {
				let component

				return {
					onStart: (props) => {
						component = new ReactRenderer(NoteLinkList, {
							props: {items: props.items, command: (item) => props.command(item)},
							editor: props.editor,
						})
						component.element.style.position = 'fixed'
						component.element.style.zIndex = '60'
						document.body.appendChild(component.element)
						if (props.clientRect) positionElement(component.element, props.clientRect)
					},
					onUpdate: (props) => {
						component.updateProps({items: props.items, command: (item) => props.command(item)})
						if (props.clientRect) positionElement(component.element, props.clientRect)
					},
					onKeyDown: (props) => {
						if (props.event.key === 'Escape') {
							props.editor.chain().focus().deleteRange(props.range).run()
							return true
						}
						return component.ref?.onKeyDown(props) ?? false
					},
					onExit: () => {
						component.element.remove()
						component.destroy()
					},
				}
			},
		},
	})
}
