function ConfirmModal({isOpen, title, message, confirmLabel = 'Confirm', onConfirm, onCancel}) {
	if (!isOpen) return null

	return (
		<div
			className="fixed inset-0 bg-[#0a081c]/60 backdrop-blur-[3px] flex items-center justify-center z-30 p-4 min-[381px]:p-6"
			onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
		>
			<div className="w-full max-w-[380px] bg-[linear-gradient(160deg,rgba(36,30,74,0.97),rgba(26,20,67,0.99))] border border-[#a29bfe]/35 rounded-[20px] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
				<h3 className="text-base font-bold mb-2">{title}</h3>
				<p className="text-[13px] text-white/60 leading-[1.5] mb-5">{message}</p>

				<div className="flex justify-end gap-2">
					<button
						onClick={onCancel}
						className="py-[9px] px-4 text-[13px] font-semibold rounded-[10px] bg-white/6 border border-white/12 text-white/75 cursor-pointer transition-[opacity,transform] duration-200 hover:bg-white/10 active:scale-[0.98]"
					>Cancel</button>
					<button
						onClick={onConfirm}
						className="py-[9px] px-4 text-[13px] font-semibold rounded-[10px] bg-[#d63031] border-none text-white cursor-pointer transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-[0.98]"
					>{confirmLabel}</button>
				</div>
			</div>
		</div>
	)
}

export default ConfirmModal
