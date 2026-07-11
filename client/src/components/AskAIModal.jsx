import { useState } from 'react'
import api from '../api/axios'

function AskAIModal({isOpen, onClose}) {
	const [question, setQuestion] = useState('')
	const [answer, setAnswer] = useState(null)
	const [sources, setSources] = useState([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState('')

	if (!isOpen) return null

	const reset = () => {
		setQuestion('')
		setAnswer(null)
		setSources([])
		setError('')
	}

	const handleClose = () => {
		reset()
		onClose()
	}

	const handleSubmit = async (e) => {
		e.preventDefault()
		if (!question.trim() || loading) return

		setLoading(true)
		setError('')
		setAnswer(null)
		setSources([])
		try {
			const response = await api.post('/notes/ask', {question})
			setAnswer(response.data.answer)
			setSources(response.data.sources || [])
		} catch (err) {
			setError(err.response?.data?.message || 'Something went wrong, try again.')
		} finally {
			setLoading(false)
		}
	}

	return (
		<div
			className="fixed inset-0 bg-[#0a081c]/60 backdrop-blur-[3px] flex items-center justify-center z-20 p-4 min-[381px]:p-6"
			onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
		>
			<div className="w-full max-w-[480px] bg-[linear-gradient(160deg,rgba(36,30,74,0.97),rgba(26,20,67,0.99))] border border-[#a29bfe]/35 rounded-[20px] p-4 min-[381px]:p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
				<div className="flex items-center justify-between mb-3.5">
					<h3 className="text-base font-bold flex items-center gap-2">
						<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="text-[#a29bfe]"><path d="M12 2l1.8 5.6L19 9.4l-5.2 1.9L12 17l-1.8-5.7L5 9.4l5.2-1.8L12 2Z" /></svg>
						Ask Momo
					</h3>
					<button
						onClick={handleClose}
						aria-label="Close"
						className="w-7 h-7 p-0 rounded-[8px] bg-white/6 border-none text-white/62 text-xs font-semibold cursor-pointer transition-[opacity,transform] duration-200 hover:bg-white/10 hover:opacity-100 active:scale-[0.98]"
					>✕</button>
				</div>

				{!answer && !loading && (
					<p className="text-[12.5px] text-white/50 mb-3 -mt-1">Hi, I'm Momo — ask me anything about your notes and I'll dig up the answer.</p>
				)}

				<form onSubmit={handleSubmit} className="flex flex-col gap-3">
					<textarea
						placeholder="Ask Momo about your notes..."
						rows={2}
						value={question}
						onChange={(e) => setQuestion(e.target.value)}
						autoFocus
						className="input-base resize-none"
					/>

					<button type="submit" disabled={loading || !question.trim()} className="btn-primary p-[11px] text-[13.5px] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
						{loading && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-[spin_0.9s_linear_infinite]"><path d="M21 12a9 9 0 1 1-9-9" strokeLinecap="round" /></svg>}
						{loading ? 'Momo is thinking...' : 'Ask'}
					</button>

					{error && <p className="text-[#ff7675] text-sm text-center">{error}</p>}

					{answer && (
						<div className="bg-gradient-to-br from-[#a29bfe]/12 to-[#e84393]/10 border border-[#a29bfe]/25 rounded-[10px] py-2.5 px-3 flex flex-col gap-2">
							<p className="text-[13px] text-white/85 leading-[1.55]">{answer}</p>
							{sources.length > 0 && (
								<div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-white/10">
									<span className="text-[10.5px] font-semibold text-white/40 uppercase tracking-[0.04em]">Based on</span>
									{sources.map((s) => (
										<span key={s._id} className="bg-[#6c5ce7]/30 text-[#a29bfe] text-[11px] py-[3px] px-2.5 rounded-full">{s.title}</span>
									))}
								</div>
							)}
						</div>
					)}
				</form>
			</div>
		</div>
	)
}

export default AskAIModal
