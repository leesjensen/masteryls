import React from 'react';

function TopicForm({ title, type, onSubmit, onCancel }) {
  const [newTitle, setNewTitle] = React.useState(title || '');
  const [newType, setNewType] = React.useState(type || 'instruction');
  const [newDescription, setNewDescription] = React.useState('');

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      onSubmit(newTitle, newDescription, newType);
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="mb-0.5 ml-4 p-2 bg-gray-50 border rounded">
      <div className="flex flex-col gap-2">
        <input type="text" placeholder="Topic title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={handleKeyDown} className="px-2 py-1 border rounded text-sm" autoFocus />
        <input type="text" placeholder="Topic description" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} onKeyDown={handleKeyDown} className="px-2 py-1 border rounded text-sm" />
        <select value={newType} onChange={(e) => setNewType(e.target.value)} className="px-2 py-1 border rounded text-sm">
          <option value="instruction">Instruction</option>
          <option value="video">Video</option>
          <option value="quiz">Quiz</option>
          <option value="project">Project</option>
        </select>
        <div className="flex gap-2">
          <button onClick={() => onSubmit(newTitle, newDescription, newType)} className="px-2 py-1 bg-blue-600 text-white rounded text-xs disabled:bg-gray-300" disabled={!newTitle.trim()}>
            Add
          </button>
          <button onClick={onCancel} className="px-2 py-1 bg-gray-600 text-white rounded text-xs">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default TopicForm;
