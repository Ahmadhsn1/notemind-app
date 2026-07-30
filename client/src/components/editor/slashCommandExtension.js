import {Extension} from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import {ReactRenderer} from '@tiptap/react'
import {computePosition, offset, flip, shift} from '@floating-ui/dom'
import SlashCommandList from './SlashCommandList'
import {getSlashCommandItems} from './slashCommandItems'

// Positions the floating list against the "/query" text's screen rect —
// same @floating-ui/dom package Tiptap's own BubbleMenu uses internally,
// no tippy.js dependency needed.
const positionElement = (element, getRect) => {
	const virtualEl = {getBoundingClientRect: getRect}
	computePosition(virtualEl, element, {
		placement: 'bottom-start',
		middleware: [offset(6), flip(), shift({padding: 8})],
	}).then(({x, y}) => {
		Object.assign(element.style, {left: `${x}px`, top: `${y}px`})
	})
}

// aiContinueRef: a ref (owned by NoteEditor) pointing at its runAssist('continue')
// closure, so the "Continue writing with AI" item shares NoteEditor's existing
// loading/error UI instead of a second AI-request codepath.
export function createSlashCommand(aiContinueRef) {
	return Extension.create({
		name: 'slashCommand',

		addOptions() {
			return {
				suggestion: {
					char: '/',
					command: ({editor, range, props}) => props.run(editor, range),
					items: ({query}) => getSlashCommandItems(query, aiContinueRef),
					render: () => {
						let component

						return {
							onStart: (props) => {
								component = new ReactRenderer(SlashCommandList, {
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
			}
		},

		addProseMirrorPlugins() {
			return [
				Suggestion({
					editor: this.editor,
					...this.options.suggestion,
				}),
			]
		},
	})
}
