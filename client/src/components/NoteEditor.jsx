import {useState, useRef, useEffect} from 'react'
import {useEditor, EditorContent} from '@tiptap/react'
import {BubbleMenu} from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import api from '../api/axios'
import {legacyBodyToHtml} from '../utils/legacyBodyToHtml'
import {useToast} from '../context/ToastContext'
import {SPARKLE_PATH, TOOLBAR_ICON} from './editor/icons'
import {createSlashCommand} from './editor/slashCommandExtension'
import {createNoteLinkExtension} from './editor/noteLinkExtension'
import {strictCodeBlockExtension} from './editor/strictCodeBlockExtension'
import {noteImageExtension} from './editor/imageExtension'

function ToolbarButton({onClick, active, disabled, label, icon, loading, fill}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			aria-label={label}
			title={label}
			className={`w-7 h-7 p-0 rounded-[7px] flex items-center justify-center border cursor-pointer transition-[opacity,transform] duration-200 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed ${
				active
					? 'bg-accent/22 border-accent/40 text-accent'
					: 'bg-ink-deep/55 border-ink/15 text-ink/62 hover:bg-ink/10 hover:text-ink'
			}`}
		>
			<svg width="13" height="13" viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loading ? 'animate-[spin_0.9s_linear_infinite]' : ''}>
				{icon === 'sparkle' ? SPARKLE_PATH : TOOLBAR_ICON[icon]}
			</svg>
		</button>
	)
}

const WRITING_ASSIST_ACTIONS = {
	continue: 'Continue writing',
	improve: 'Improve writing',
	shorten: 'Shorten',
	'fix-grammar': 'Fix grammar',
}

// Not implemented in Firefox as of this writing — the mic button just hides
// itself there rather than rendering something that can't work
// (progressive enhancement, no polyfill/fallback needed).
const SpeechRecognitionAPI = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

// contentHtml is the source of truth; legacyBody only matters the first time
// a pre-rich-text note is opened (no contentHtml saved yet). The editor is
// remounted fresh each time NoteFormModal opens (it unmounts on close), so
// content only needs to be set once here — no sync effect required.
function NoteEditor({contentHtml, legacyBody, onChange, placeholder, notes, currentNoteId}) {
	const toast = useToast()
	const [assistLoading, setAssistLoading] = useState(null)
	const [assistError, setAssistError] = useState('')
	const [imageUploading, setImageUploading] = useState(false)
	const imageInputRef = useRef(null)
	// Points at the latest runAssist('continue') closure below — read by the
	// slash-command menu's "Continue writing with AI" item, defined outside
	// this component and unable to close over per-render state directly.
	const aiContinueRef = useRef(null)
	// Live {notes, excludeId} for the [[ note-link picker — same live-ref
	// pattern as aiContinueRef, since the extension is created once but needs
	// fresh data on every keystroke, long after this render has passed.
	const linkableNotesRef = useRef({notes: [], excludeId: null})
	const [isListening, setIsListening] = useState(false)
	const recognitionRef = useRef(null)

	// Neither extension reads its ref synchronously here — both only close
	// over it for later use inside command/item handlers run on user
	// interaction.
	// eslint-disable-next-line react-hooks/refs -- see comment above
	const slashCommandExtension = createSlashCommand(aiContinueRef)
	// eslint-disable-next-line react-hooks/refs -- see comment above
	const noteLinkExtension = createNoteLinkExtension(linkableNotesRef)

	const editor = useEditor({
		extensions: [
			StarterKit.configure({heading: {levels: [1, 2, 3]}, codeBlock: false}),
			strictCodeBlockExtension,
			TaskList,
			TaskItem.configure({nested: true}),
			Placeholder.configure({placeholder: placeholder || 'Write something...'}),
			slashCommandExtension,
			noteLinkExtension,
			noteImageExtension,
		],
		content: contentHtml || legacyBodyToHtml(legacyBody || ''),
		onUpdate: ({editor}) => onChange({html: editor.getHTML(), text: editor.getText()}),
	})

	// Defined before the `!editor` guard (with the other hooks) so hook order
	// stays consistent across renders — runAssist/the effect just never get
	// invoked with a null editor in practice, since the UI that calls them
	// (toolbar button, slash menu) only renders once editor exists below.
	const runAssist = async (action) => {
		const {from, to, empty} = editor.state.selection
		const text = action === 'continue' && empty
			? editor.getText()
			: editor.state.doc.textBetween(from, to, ' ')

		if (!text.trim() || assistLoading) return

		setAssistLoading(action)
		setAssistError('')
		try {
			const response = await api.post('/notes/ai-assist', {action, text})
			const result = response.data.result
			if (!result) return

			if (action === 'continue' && empty) {
				// Context sent to the AI was always the whole document
				// (editor.getText() above), so the continuation must land at
				// the end regardless of where the cursor was when clicked.
				editor.chain().focus('end').insertContent({type: 'text', text: `${text.endsWith(' ') || !text ? '' : ' '}${result}`}).run()
			} else {
				editor.chain().focus().insertContentAt({from, to}, {type: 'text', text: result}).run()
			}
		} catch {
			setAssistError('AI assist failed. Try again.')
		} finally {
			setAssistLoading(null)
		}
	}

	const handleImageButtonClick = () => {
		if (imageUploading) return
		imageInputRef.current?.click()
	}

	const handleImageSelected = async (e) => {
		const file = e.target.files?.[0]
		e.target.value = ''
		if (!file) return

		setImageUploading(true)
		try {
			const formData = new FormData()
			formData.append('image', file)
			const response = await api.post('/notes/upload-image', formData)
			editor.chain().focus().setImage({src: response.data.url}).run()
		} catch (err) {
			toast.error(err.response?.data?.message || 'Image upload failed. Try again.')
		} finally {
			setImageUploading(false)
		}
	}

	useEffect(() => {
		aiContinueRef.current = () => runAssist('continue')
		linkableNotesRef.current = {notes: notes || [], excludeId: currentNoteId}
	})

	// Stops any in-progress dictation if the editor unmounts (modal closed)
	// mid-recording, rather than leaving the mic listening in the background.
	useEffect(() => {
		return () => recognitionRef.current?.stop()
	}, [])

	const toggleDictation = () => {
		if (!SpeechRecognitionAPI || !editor) return

		if (isListening) {
			recognitionRef.current?.stop()
			return
		}

		const recognition = new SpeechRecognitionAPI()
		recognition.continuous = true
		recognition.interimResults = true
		recognition.lang = navigator.language || 'en-US'

		recognition.onresult = (event) => {
			let finalTranscript = ''
			for (let i = event.resultIndex; i < event.results.length; i++) {
				if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript
			}
			if (finalTranscript.trim()) {
				editor.chain().focus().insertContent(`${finalTranscript.trim()} `).run()
			}
		}
		recognition.onerror = () => setIsListening(false)
		recognition.onend = () => setIsListening(false)

		recognitionRef.current = recognition
		recognition.start()
		setIsListening(true)
	}

	if (!editor) return null

	return (
		<div className="rounded-[10px] border border-ink/12 bg-ink/8 focus-within:border-accent transition-colors duration-200">
			<div className="flex flex-wrap items-center gap-1 p-1.5 border-b border-ink/10">
				<ToolbarButton label="Bold" icon="bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} />
				<ToolbarButton label="Italic" icon="italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} />
				<ToolbarButton label="Strikethrough" icon="strike" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} />
				<ToolbarButton label="Underline" icon="underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} />
				<ToolbarButton label="Heading" icon="h2" active={editor.isActive('heading', {level: 2})} onClick={() => editor.chain().focus().toggleHeading({level: 2}).run()} />
				<ToolbarButton label="Bullet list" icon="bulletList" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} />
				<ToolbarButton label="Numbered list" icon="orderedList" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
				<ToolbarButton label="Checklist" icon="taskList" active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()} />
				<ToolbarButton label="Quote" icon="quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
				<ToolbarButton label="Code block" icon="codeBlock" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()} />
				<ToolbarButton label="Insert image" icon="image" loading={imageUploading} disabled={imageUploading} onClick={handleImageButtonClick} />
				<input
					ref={imageInputRef}
					type="file"
					accept="image/png,image/jpeg,image/gif,image/webp"
					onChange={handleImageSelected}
					className="hidden"
				/>
				<div className="w-px h-4 bg-ink/12 mx-0.5" />
				{SpeechRecognitionAPI && (
					<button
						type="button"
						onClick={toggleDictation}
						aria-label={isListening ? 'Stop dictation' : 'Dictate with voice'}
						title={isListening ? 'Stop dictation' : 'Dictate with voice'}
						className={`relative w-7 h-7 p-0 rounded-[7px] flex items-center justify-center border cursor-pointer transition-[opacity,transform] duration-200 active:scale-[0.98] ${
							isListening
								? 'bg-danger/22 border-danger/50 text-danger-light'
								: 'bg-ink-deep/55 border-ink/15 text-ink/62 hover:bg-ink/10 hover:text-ink'
						}`}
					>
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{TOOLBAR_ICON.mic}</svg>
						{isListening && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-danger-light animate-[ping_1.2s_ease-in-out_infinite]" />}
					</button>
				)}
				<ToolbarButton
					label="Continue writing with AI"
					icon="sparkle"
					fill
					loading={assistLoading === 'continue'}
					disabled={assistLoading !== null}
					onClick={() => runAssist('continue')}
				/>
			</div>

			{editor && (
				<BubbleMenu editor={editor} options={{placement: 'top'}}>
					<div className="flex items-center gap-1 p-1 rounded-[10px] border border-accent/35 bg-[linear-gradient(160deg,var(--color-panel-a),var(--color-panel-b))] shadow-[0_12px_30px_rgba(0,0,0,0.45)]">
						{Object.entries(WRITING_ASSIST_ACTIONS).filter(([action]) => action !== 'continue').map(([action, label]) => (
							<button
								key={action}
								type="button"
								onClick={() => runAssist(action)}
								disabled={assistLoading !== null}
								className="flex items-center gap-1 px-2 py-1.5 rounded-[7px] text-[11.5px] font-medium text-ink/75 cursor-pointer transition-colors duration-150 hover:bg-accent/18 hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
							>
								<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" className={assistLoading === action ? 'animate-[spin_0.9s_linear_infinite]' : ''}>{SPARKLE_PATH}</svg>
								{label}
							</button>
						))}
					</div>
				</BubbleMenu>
			)}

			{/* min-h-[110px] is on the ProseMirror child, not this wrapper — Tiptap
			mounts the actual contenteditable as a child div that only sizes to its
			own content, so a min-height on the wrapper alone leaves empty-looking
			space below short content that isn't actually part of the clickable
			editable area (clicking there does nothing). */}
			<EditorContent
				editor={editor}
				onClick={() => editor.chain().focus().run()}
				className="note-prose max-h-[40vh] overflow-y-auto px-3.5 py-3 text-[13.5px] text-ink/90 cursor-text [&_.ProseMirror]:min-h-[110px] [&_.ProseMirror]:outline-none"
			/>

			{assistError && <div className="px-3.5 pb-2.5 text-[11.5px] text-danger-light">{assistError}</div>}
		</div>
	)
}

export default NoteEditor
