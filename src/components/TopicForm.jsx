import React from 'react';

function TopicForm({ newTopicTitle, setNewTopicTitle, newTopicType, setNewTopicType, onSubmit, onCancel }) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      onSubmit();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="mb-0.5 ml-4 p-2 bg-gray-50 border rounded">
      <div className="flex flex-col gap-2">
        <input type="text" placeholder="Topic title" value={newTopicTitle} onChange={(e) => setNewTopicTitle(e.target.value)} onKeyDown={handleKeyDown} className="px-2 py-1 border rounded text-sm" autoFocus />
        <select value={newTopicType} onChange={(e) => setNewTopicType(e.target.value)} className="px-2 py-1 border rounded text-sm">
          <option value="instruction">Instruction</option>
          <option value="video">Video</option>
          <option value="quiz">Quiz</option>
          <option value="project">Project</option>
        </select>
        <div className="flex gap-2">
          <button onClick={onSubmit} className="px-2 py-1 bg-blue-600 text-white rounded text-xs" disabled={!newTopicTitle.trim()}>
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
