import { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import NoteCard from '../components/NoteCard';

function Dashboard() {
  const [notes, setNotes] = useState([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const { user, logout } = useAuth();

  const fetchNotes = async () => {
    const response = await api.get('/notes');
    setNotes(response.data);
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    await api.post('/notes', { title, body });
    setTitle('');
    setBody('');
    fetchNotes();
  };

  const handleDelete = async (id) => {
    await api.delete(`/notes/${id}`);
    fetchNotes();
  };

  return (
    <div>
      <h2>Welcome, {user?.name}</h2>
      <button onClick={logout}>Logout</button>

      <form onSubmit={handleCreate}>
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
        <button type="submit">Add Note</button>
      </form>

      <div>
        {notes.map((note) => (
          <NoteCard key={note._id} note={note} onDelete={handleDelete} />
        ))}
      </div>
    </div>
  );
}

export default Dashboard;
