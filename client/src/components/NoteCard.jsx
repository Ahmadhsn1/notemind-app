function NoteCard({ note, onDelete, onEdit }) {
  return (
    <div className="note-card">
      <h3>{note.title}</h3>
      <p>{note.body}</p>
      <p className="note-meta"><strong>Folder:</strong> {note.folder}</p>
      {note.tags.length > 0 && (
        <p className="note-meta"><strong>Tags:</strong> {note.tags.join(', ')}</p>
      )}
      <div className="card-buttons">
        <button onClick={() => onEdit(note)}>Edit</button>
        <button className="delete-btn" onClick={() => onDelete(note._id)}>Delete</button>
      </div>
    </div>
  );
}

export default NoteCard;
