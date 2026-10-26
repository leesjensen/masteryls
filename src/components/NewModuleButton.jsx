import React, { useState } from 'react';
import Button from './ui/Button.jsx';
import Input from './ui/Input.jsx';

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
      <button className="text-gray-400 hover:text-blue-600 text-sm py-1" onClick={() => setShowForm(true)}>
        + Add New Module
      </button>
    );
  }
  return (
    <div className="mb-0.5 ml-4 p-2 bg-gray-50 border rounded">
      <div className="flex flex-col gap-2">
        <Input size="sm" type="text" placeholder="Topic title" onChange={(e) => setTitle(e.target.value)} onKeyDown={handleKeyDown} autoFocus />
        <div className="flex gap-2">
          <Button size="xs" onClick={() => handleCreate()} disabled={!title.trim()}>
            Add
          </Button>
          <Button size="xs" variant="secondary" onClick={() => handleCancel()}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
