import {useState} from 'react'
import api from '../api/axios'

function NoteFormModal({
	isOpen,
	isEditing,
	title,
	body,
	tags,
	folder,
	existingFolders,
	onTitleChange,
	onBodyChange,
	onTagsChange,
	onFolderChange,
	onSubmit,
	onClose,
}) {
	const [titleLoading, setTitleLoading] = useState(false)

	if (!isOpen) return null

	const addingFolder = folder === '' || !existingFolders.includes(folder)

	const handleFolderSelect = (e) => {
		if (e.target.value === '__new__') {
			onFolderChange('')
		} else {
			onFolderChange(e.target.value)
		}
	}

	const handleGenerateTitle = async () => {
		if (!body.trim() || titleLoading) return
		setTitleLoading(true)
		try {
			const response = await api.post('/notes/suggest-title', {body})
			onTitleChange(response.data.title)
		} catch {
			alert('Title generation failed. Try again.')
		} finally {
			setTitleLoading(false)
		}
	}

	return (
		<div
			className="fixed inset-0 bg-[#0a081c]/60 backdrop-blur-[3px] flex items-center justify-center z-20 p-4 min-[381px]:p-6"
			onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
		>
			<div className="w-full max-w-[440px] bg-[linear-gradient(160deg,rgba(36,30,74,0.97),rgba(26,20,67,0.99))] border border-[#a29bfe]/35 rounded-[20px] p-4 min-[381px]:p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
				<div className="flex items-center justify-between mb-3.5">
					<h3 className="text-base font-bold">{isEditing ? 'Edit note' : 'New note'}</h3>
					<button
						onClick={onClose}
						aria-label="Close"
						className="w-7 h-7 p-0 rounded-[8px] bg-white/6 border-none text-white/62 text-xs font-semibold cursor-pointer transition-[opacity,transform] duration-200 hover:bg-white/10 hover:opacity-100 active:scale-[0.98]"
					>✕</button>
				</div>

				<form onSubmit={onSubmit} className="flex flex-col gap-3">
					<div className="relative flex items-center">
						<input
							type="text"
							placeholder="Title"
							value={title}
							onChange={(e) => onTitleChange(e.target.value)}
							autoFocus
							className="input-base w-full pr-10"
						/>
						<button
							type="button"
							onClick={handleGenerateTitle}
							disabled={!body.trim() || titleLoading}
							aria-label="Generate title with AI"
							title="Generate title with AI"
							className="absolute right-1.5 w-[26px] h-[26px] p-0 rounded-[7px] flex items-center justify-center bg-[#0f0c29]/55 border border-white/15 text-white/62 cursor-pointer transition-[opacity,transform] duration-200 hover:bg-[#a29bfe]/22 hover:text-[#a29bfe] hover:opacity-100 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#0f0c29]/55 disabled:hover:text-white/62"
						>
							<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className={titleLoading ? 'animate-[spin_0.9s_linear_infinite]' : ''}><path d="M12 2l1.8 5.6L19 9.4l-5.2 1.9L12 17l-1.8-5.7L5 9.4l5.2-1.8L12 2Z" /></svg>
						</button>
					</div>
					<textarea
						placeholder="Write something..."
						rows={4}
						value={body}
						onChange={(e) => onBodyChange(e.target.value)}
						className="input-base resize-none"
					/>

					{isEditing && (
						<input
							type="text"
							placeholder="Tags, comma separated"
							value={tags}
							onChange={(e) => onTagsChange(e.target.value)}
							className="input-base"
						/>
					)}

					{addingFolder ? (
						<input
							type="text"
							placeholder="New folder name"
							value={folder}
							onChange={(e) => onFolderChange(e.target.value)}
							autoFocus
							className="input-base"
						/>
					) : (
						<select value={folder} onChange={handleFolderSelect} className="input-base">
							{existingFolders.map((f) => (
								<option key={f} value={f}>{f}</option>
							))}
							<option value="__new__">+ New folder</option>
						</select>
					)}

					<div className="flex gap-2.5 mt-1">
						<button
							type="button"
							onClick={onClose}
							className="bg-white/8 border border-white/20 text-white rounded-[10px] font-semibold cursor-pointer transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-[0.98] flex-1 p-[11px] text-[13.5px]"
						>Cancel</button>
						<button type="submit" className="btn-primary flex-1 p-[11px] text-[13.5px]">{isEditing ? 'Save changes' : 'Add note'}</button>
					</div>
				</form>
			</div>
		</div>
	)
}

export default NoteFormModal
