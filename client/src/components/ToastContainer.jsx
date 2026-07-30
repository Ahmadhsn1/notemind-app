import {useToast} from '../context/ToastContext'

const TYPE_STYLES = {
	success: {border: 'border-growth/35', dot: 'bg-growth'},
	error: {border: 'border-danger/35', dot: 'bg-danger-light'},
	info: {border: 'border-accent/35', dot: 'bg-accent'},
}

function ToastContainer() {
	const {toasts, dismiss} = useToast()

	if (toasts.length === 0) return null

	return (
		<div className="fixed z-50 bottom-4 right-4 left-4 min-[481px]:left-auto flex flex-col-reverse gap-2 min-[481px]:w-[320px]">
			{toasts.map((t) => {
				const style = TYPE_STYLES[t.type] || TYPE_STYLES.info
				return (
					<div
						key={t.id}
						role="status"
						className={`flex items-start gap-2.5 py-3 px-3.5 rounded-[12px] border ${style.border} bg-[linear-gradient(160deg,var(--color-panel-a),var(--color-panel-b))] shadow-[0_12px_30px_rgba(0,0,0,0.4)] animate-toast-in`}
					>
						<span className={`w-2 h-2 mt-1 rounded-full shrink-0 ${style.dot}`} />
						<p className="flex-1 text-[13px] text-ink/85 leading-[1.4]">{t.message}</p>
						<button
							onClick={() => dismiss(t.id)}
							aria-label="Dismiss"
							className="shrink-0 w-5 h-5 flex items-center justify-center rounded-md text-ink/40 cursor-pointer transition-colors duration-150 hover:bg-ink/10 hover:text-ink/80"
						>✕</button>
					</div>
				)
			})}
		</div>
	)
}

export default ToastContainer
