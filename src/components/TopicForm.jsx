import React from 'react';

function TopicForm({ topic = { state: 'stub' }, onSubmit, onCancel, isLoading }) {
  const [newTitle, setNewTitle] = React.useState(topic.title || '');
  const [newType, setNewType] = React.useState(topic.type || 'instruction');
  const [newDescription, setNewDescription] = React.useState(topic.description || '');

  const submitButtonText = topic.state === 'stub' ? 'Generate' : 'Save';

  return (
    <div className="mb-0.5 ml-4 p-2 bg-gray-50 border rounded relative">
      {isLoading && (
        <div className="absolute inset-0 bg-gray-50 bg-opacity-80 flex items-center justify-center rounded z-10">
          <div className="flex items-center gap-2 text-gray-600">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-amber-600"></div>
            <span className="text-sm">Adding topic...</span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <input type="text" placeholder="Topic title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="px-2 py-1 border rounded text-sm disabled:bg-gray-100 disabled:cursor-not-allowed" autoFocus disabled={isLoading} />
        <textarea placeholder="Description" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} className="px-2 py-1 border rounded text-sm disabled:bg-gray-100 disabled:cursor-not-allowed" rows={3} disabled={isLoading} />
        <select value={newType} onChange={(e) => setNewType(e.target.value)} className="px-2 py-1 border rounded text-sm disabled:bg-gray-100 disabled:cursor-not-allowed" disabled={isLoading}>
          <option value="instruction">Instruction</option>
          <option value="video">Video</option>
          <option value="exam">Exam</option>
          <option value="project">Project</option>
        </select>
        <div className="flex gap-2">
          <button onClick={() => onSubmit(newTitle, newDescription, newType)} className="px-2 py-1 bg-blue-600 text-white rounded text-xs disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-1" disabled={!newTitle.trim() || isLoading}>
            {isLoading && <div className="animate-spin rounded-full h-3 w-3 border border-white border-t-transparent"></div>}
            {isLoading ? 'Adding...' : submitButtonText || 'Add'}
          </button>
          <button onClick={onCancel} className="px-2 py-1 bg-gray-600 text-white rounded text-xs disabled:bg-gray-400 disabled:cursor-not-allowed" disabled={isLoading}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default TopicForm;
