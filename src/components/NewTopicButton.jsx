import React, { useState } from 'react';
import TopicForm from './TopicForm';

export default function NewTopicButton({ moduleIndex, courseOps }) {
  const [showForm, setShowForm] = useState(false);

  const handleSubmitForm = (title, type) => {
    courseOps.addTopic(moduleIndex, title, type);
    setShowForm(false);
  };
  if (!showForm) {
    return (
      <button className="text-gray-400 hover:text-amber-600 text-sm py-1" onClick={() => setShowForm(true)}>
        + Add New Topic
      </button>
    );
  }
  return <TopicForm onSubmit={handleSubmitForm} onCancel={() => setShowForm(false)} />;
}
