import React, { useState } from 'react';
import TopicForm from './TopicForm';
import useClickOutside from '../hooks/useClickOutside';

export default function NewTopicButton({ moduleIndex, courseOps }) {
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const editorRef = React.useRef(null);

  const handleSubmitForm = async (title, description, type) => {
    setIsLoading(true);
    try {
      await courseOps.addTopic(moduleIndex, title, description, type);
      setShowForm(false);
    } catch (error) {
      console.error('Error adding topic:', error);
      // Keep form open on error so user can retry
    } finally {
      setIsLoading(false);
    }
  };

  useClickOutside(editorRef, () => {
    setShowForm(false);
  });

  if (!showForm) {
    return (
      <button className="text-gray-400 hover:text-amber-600 text-sm py-1 disabled:opacity-50 disabled:cursor-not-allowed" onClick={() => setShowForm(true)} disabled={isLoading}>
        + Add New Topic
      </button>
    );
  }

  return (
    <div ref={editorRef}>
      <TopicForm onSubmit={handleSubmitForm} onCancel={() => setShowForm(false)} isLoading={isLoading} />
    </div>
  );
}
