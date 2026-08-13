import {useRef} from 'react'
import {NOTE_TEMPLATES} from '../utils/noteTemplates'
import useModalA11y from '../hooks/useModalA11y'

function TemplatePickerModal({isOpen, onSelect, onClose}) {
	const panelRef = useRef(null)
	useModalA11y(isOpen, onClose, panelRef)

	if (!isOpen) return null

	return (
		<div
			className="fixed inset-0 bg-[#0a0b10]/60 backdrop-blur-[3px] flex items-center justify-center z-20 p-4 min-[381px]:p-6"
			onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
		>
			<div
				ref={panelRef}
				role="dialog"
				aria-modal="true"
				aria-label="New note"
				tabIndex={-1}
				className="w-full max-w-[440px] bg-[linear-gradient(160deg,var(--color-panel-a),var(--color-panel-b))] border border-accent/35 rounded-[20px] p-4 min-[381px]:p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)] outline-none"
			>
				<div className="flex items-center justify-between mb-3.5">
					<h3 className="text-base font-bold">New note</h3>
					<button
						onClick={onClose}
						aria-label="Close"
						className="w-7 h-7 p-0 rounded-[8px] bg-ink/6 border-none text-ink/62 text-xs font-semibold cursor-pointer transition-[opacity,transform] duration-200 hover:bg-ink/10 hover:opacity-100 active:scale-[0.98]"
					>✕</button>
				</div>

				<div className="flex flex-col gap-2">
					{NOTE_TEMPLATES.map((template) => (
						<button
							key={template.key}
							type="button"
							onClick={() => onSelect(template)}
							className="text-left p-3 rounded-[12px] bg-ink/6 border border-ink/12 cursor-pointer transition-[opacity,transform,background-color] duration-200 hover:bg-accent/15 hover:border-accent/35 active:scale-[0.99]"
						>
							<div className="text-[13.5px] font-semibold">{template.label}</div>
							<div className="text-[12px] text-ink/55 mt-0.5">{template.description}</div>
						</button>
					))}
				</div>
			</div>
		</div>
	)
}

export default TemplatePickerModal
