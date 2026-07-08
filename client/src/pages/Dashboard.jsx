import { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import NoteCard from '../components/NoteCard';

function Dashboard() {
  const [notes, setNotes] = useState([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');
  const [folder, setFolder] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('All');

  const { user, logout } = useAuth();

  const fetchNotes = async () => {
    const response = await api.get('/notes');
    setNotes(response.data);
  };

  const folders = ['All', ...new Set(notes.map((note) => note.folder))];

  const filteredNotes = notes.filter((note) => {
    const matchesSearch =
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.body.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFolder =
      selectedFolder === 'All' || note.folder === selectedFolder;
    return matchesSearch && matchesFolder;
  });

  useEffect(() => {
    fetchNotes();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const noteData = {
      title,
      body,
      tags: tags.split(',').map((tag) => tag.trim()).filter((tag) => tag !== ''),
      folder: folder.trim() || 'General',
    };

    if (editingId) {
      await api.put(`/notes/${editingId}`, noteData);
      setEditingId(null);
    } else {
      await api.post('/notes', noteData);
    }

    setTitle('');
    setBody('');
    setTags('');
    setFolder('');
    fetchNotes();
  };

  const handleEdit = (note) => {
    setEditingId(note._id);
    setTitle(note.title);
    setBody(note.body);
    setTags(note.tags.join(', '));
    setFolder(note.folder);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setTitle('');
    setBody('');
    setTags('');
    setFolder('');
  };

  const handleDelete = async (id) => {
    await api.delete(`/notes/${id}`);
    fetchNotes();
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>Welcome, {user?.name}</h2>
        <button className="logout-btn" onClick={logout}>Logout</button>
      </div>

      <form className="note-form" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          type="text"
          placeholder="Body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <input
          type="text"
          placeholder="Tags (comma separated, e.g. work, ideas)"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
        <input
          type="text"
          placeholder="Folder (default: General)"
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
        />
        <div className="form-buttons">
          <button type="submit">{editingId ? 'Update Note' : 'Add Note'}</button>
          {editingId && (
            <button type="button" className="cancel-btn" onClick={handleCancelEdit}>
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="filter-bar">
        <input
          type="text"
          placeholder="Search notes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <select
          value={selectedFolder}
          onChange={(e) => setSelectedFolder(e.target.value)}
        >
          {folders.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      {filteredNotes.length === 0 ? (
        <p className="empty-state">No notes found. Create your first note above!</p>
      ) : (
        <div className="notes-grid">
          {filteredNotes.map((note) => (
            <NoteCard
              key={note._id}
              note={note}
              onDelete={handleDelete}
              onEdit={handleEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default Dashboard;
