import React, { useState } from 'react';

export default function NewModuleButton({ courseOps }) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');

  const handleCreate = async () => {
    handleCancel();
    await courseOps.addModule(title);
  };

  const handleCancel = async () => {
    setShowForm(false);
    setTitle('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleCreate();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (!showForm) {
    return (
      <button className="text-gray-400 hover:text-amber-600 text-sm py-1" onClick={() => setShowForm(true)}>
        + Add New Module
      </button>
    );
  }
  return (
    <div className="mb-0.5 ml-4 p-2 bg-gray-50 border rounded">
      <div className="flex flex-col gap-2">
        <input type="text" placeholder="Topic title" onChange={(e) => setTitle(e.target.value)} onKeyDown={handleKeyDown} className="px-2 py-1 border rounded text-sm" autoFocus />
        <div className="flex gap-2">
          <button onClick={() => handleCreate()} className="px-2 py-1 bg-blue-600 text-white rounded text-xs disabled:bg-gray-300" disabled={!title.trim()}>
            Add
          </button>
          <button onClick={() => handleCancel()} className="px-2 py-1 bg-gray-600 text-white rounded text-xs">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
