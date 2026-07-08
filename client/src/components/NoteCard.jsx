function NoteCard({ note, onDelete }) {
  return (
    <div style={{ border: '1px solid #ccc', padding: '10px', marginBottom: '10px' }}>
      <h3>{note.title}</h3>
      <p>{note.body}</p>
      <p><strong>Folder:</strong> {note.folder}</p>
      <p><strong>Tags:</strong> {note.tags.join(', ')}</p>
      <button onClick={() => onDelete(note._id)}>Delete</button>
    </div>
  );
}

export default NoteCard;
