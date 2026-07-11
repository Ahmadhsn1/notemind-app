import {useState, useEffect} from 'react'
import api from '../api/axios'
import {useAuth} from '../context/AuthContext'
import NoteCard from '../components/NoteCard'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import NoteFormModal from '../components/NoteFormModal'
import AskAIModal from '../components/AskAIModal'
import ConfirmModal from '../components/ConfirmModal'
import NoteViewModal from '../components/NoteViewModal'

function Dashboard() {
	const [notes, setNotes] = useState([])
	const [title, setTitle] = useState('')
	const [body, setBody] = useState('')
	const [tags, setTags] = useState('')
	const [folder, setFolder] = useState('General')
	const [editingId, setEditingId] = useState(null)
	const [isModalOpen, setIsModalOpen] = useState(false)
	const [searchQuery, setSearchQuery] = useState('')
	const [activeFolder, setActiveFolder] = useState('All')
	const [sortMode, setSortMode] = useState('newest')
	const [viewMode, setViewMode] = useState('grid')
	const [isSidebarOpen, setIsSidebarOpen] = useState(false)
	const [isAskModalOpen, setIsAskModalOpen] = useState(false)
	const [noteToDelete, setNoteToDelete] = useState(null)
	const [viewingNoteId, setViewingNoteId] = useState(null)

	const {user, logout} = useAuth()

	const fetchNotes = async () => {
		const response = await api.get('/notes')
		setNotes(response.data)
	}

	useEffect(() => {
		fetchNotes()
	}, [])

	const folderNames = [...new Set(notes.map((note) => note.folder))]
	const existingFolders = folderNames.length > 0 ? folderNames : ['General']
	const folders = [
		{name: 'All', count: notes.length},
		...folderNames.map((name) => ({name, count: notes.filter((n) => n.folder === name).length})),
	]

	const filteredNotes = notes.filter((note) => {
		const matchesSearch =
			note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
			note.body.toLowerCase().includes(searchQuery.toLowerCase())
		const matchesFolder = activeFolder === 'All' || note.folder === activeFolder
		return matchesSearch && matchesFolder
	})

	const sortedNotes = [...filteredNotes].sort((a, b) => {
		if (sortMode === 'newest') return new Date(b.createdAt) - new Date(a.createdAt)
		if (sortMode === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt)
		return a.title.localeCompare(b.title)
	})

	const viewingIndex = viewingNoteId ? sortedNotes.findIndex((n) => n._id === viewingNoteId) : -1
	const viewingNote = viewingIndex >= 0 ? sortedNotes[viewingIndex] : null

	const resetForm = () => {
		setTitle('')
		setBody('')
		setTags('')
		setFolder(existingFolders[0])
	}

	const handleOpenNew = () => {
		setEditingId(null)
		resetForm()
		setIsModalOpen(true)
	}

	const handleEdit = (note) => {
		setEditingId(note._id)
		setTitle(note.title)
		setBody(note.body)
		setTags(note.tags.join(', '))
		setFolder(note.folder)
		setIsModalOpen(true)
	}

	const handleCloseModal = () => {
		setIsModalOpen(false)
		setEditingId(null)
		resetForm()
	}

	const handleSubmit = async (e) => {
		e.preventDefault()

		const noteData = {
			title,
			body,
			tags: tags.split(',').map((tag) => tag.trim()).filter((tag) => tag !== ''),
			folder: folder.trim() || 'General',
		}

		if (editingId) {
			await api.put(`/notes/${editingId}`, noteData)
		} else {
			await api.post('/notes', noteData)
		}

		setIsModalOpen(false)
		setEditingId(null)
		resetForm()
		fetchNotes()
	}

	const handleViewNote = (note) => {
		setViewingNoteId(note._id)
	}

	const handleCloseView = () => {
		setViewingNoteId(null)
	}

	const handleEditFromView = (note) => {
		setViewingNoteId(null)
		handleEdit(note)
	}

	const handleNavigateView = (direction) => {
		if (viewingIndex === -1 || sortedNotes.length === 0) return
		const nextIndex = (viewingIndex + direction + sortedNotes.length) % sortedNotes.length
		setViewingNoteId(sortedNotes[nextIndex]._id)
	}

	const handleRequestDelete = (note) => {
		setNoteToDelete(note)
	}

	const handleCancelDelete = () => {
		setNoteToDelete(null)
	}

	const handleConfirmDelete = async () => {
		if (!noteToDelete) return
		await api.delete(`/notes/${noteToDelete._id}`)
		setNoteToDelete(null)
		fetchNotes()
	}

	const handleSummarize = async (id) => {
		const response = await api.post(`/notes/${id}/ai-process`)
		setNotes((prev) => prev.map((n) => (n._id === id ? response.data : n)))
	}

	return (
		<div className="flex h-screen">
			<Sidebar
				folders={folders}
				activeFolder={activeFolder}
				onSelectFolder={setActiveFolder}
				onNewNote={handleOpenNew}
				onAskAI={() => setIsAskModalOpen(true)}
				userName={user?.name}
				onLogout={logout}
				isOpen={isSidebarOpen}
				onClose={() => setIsSidebarOpen(false)}
			/>

			<main className="flex-1 min-w-0 h-screen overflow-y-auto p-[18px] min-[761px]:pt-6 min-[761px]:px-7 min-[761px]:pb-7 2xl:px-12">
				<TopBar
					searchQuery={searchQuery}
					onSearchChange={setSearchQuery}
					sortMode={sortMode}
					onSortChange={setSortMode}
					viewMode={viewMode}
					onViewChange={setViewMode}
					onOpenSidebar={() => setIsSidebarOpen(true)}
				/>

				{sortedNotes.length === 0 ? (
					<div className="text-center text-white/50 py-[70px] px-5">
						<h4 className="text-[15px] font-semibold text-white/70 mb-1.5">No notes match</h4>
						<p className="text-[13px]">Try a different folder or search term, or create your first note.</p>
					</div>
				) : (
					<div className={`grid gap-4 ${viewMode === 'list' ? 'grid-cols-1' : 'grid-cols-[repeat(auto-fill,minmax(268px,1fr))]'}`}>
						{sortedNotes.map((note) => (
							<NoteCard
								key={note._id}
								note={note}
								onDelete={handleRequestDelete}
								onEdit={handleEdit}
								onSummarize={handleSummarize}
								onView={handleViewNote}
							/>
						))}
					</div>
				)}
			</main>

			<NoteFormModal
				isOpen={isModalOpen}
				isEditing={!!editingId}
				title={title}
				body={body}
				tags={tags}
				folder={folder}
				existingFolders={existingFolders}
				onTitleChange={setTitle}
				onBodyChange={setBody}
				onTagsChange={setTags}
				onFolderChange={setFolder}
				onSubmit={handleSubmit}
				onClose={handleCloseModal}
			/>

			<AskAIModal
				isOpen={isAskModalOpen}
				onClose={() => setIsAskModalOpen(false)}
			/>

			<NoteViewModal
				isOpen={!!viewingNoteId}
				note={viewingNote}
				onClose={handleCloseView}
				onEdit={handleEditFromView}
				onPrev={() => handleNavigateView(-1)}
				onNext={() => handleNavigateView(1)}
				currentIndex={viewingIndex}
				totalCount={sortedNotes.length}
			/>

			<ConfirmModal
				isOpen={!!noteToDelete}
				title="Delete note?"
				message={noteToDelete ? `"${noteToDelete.title}" will be permanently deleted. This can't be undone.` : ''}
				confirmLabel="Delete"
				onConfirm={handleConfirmDelete}
				onCancel={handleCancelDelete}
			/>
		</div>
	)
}

export default Dashboard
