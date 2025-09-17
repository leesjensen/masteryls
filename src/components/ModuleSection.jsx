import React from 'react';
import TopicItem from './TopicItem';
import TopicForm from './TopicForm';

function ModuleSection({ module, moduleIndex, isOpen, onToggle, currentTopic, changeTopic, editorVisible, showTopicForm, setShowTopicForm, newTopicTitle, setNewTopicTitle, newTopicType, setNewTopicType, onAddTopic, onRemoveTopic, cancelTopicForm }) {
  const handleAddTopicAfter = (moduleIdx, topicIdx) => {
    setShowTopicForm({ moduleIndex: moduleIdx, afterTopicIndex: topicIdx });
  };

  const handleSubmitForm = () => {
    if (showTopicForm.afterTopicIndex !== undefined) {
      onAddTopic(moduleIndex, showTopicForm.afterTopicIndex);
    } else {
      onAddTopic(moduleIndex);
    }
  };

  return (
    <li className="mb-1">
      <button onClick={() => onToggle(moduleIndex)} className="no-underline text-gray-500 font-semibold bg-transparent border-none cursor-pointer p-0 truncate max-w-full flex whitespace-nowrap overflow-hidden text-ellipsis items-center" aria-expanded={isOpen} title={module.title}>
        <span className="mr-2">{isOpen ? '▼' : '▶'}</span>
        {module.title}
      </button>
      {isOpen && (
        <ul className="list-none p-0 ml-4">
          {module.topics.map((topic, topicIndex) => (
            <TopicItem key={topic.path} topic={topic} topicIndex={topicIndex} moduleIndex={moduleIndex} currentTopic={currentTopic} changeTopic={changeTopic} editorVisible={editorVisible} onAddTopic={handleAddTopicAfter} onRemoveTopic={onRemoveTopic} />
          ))}
          {showTopicForm && showTopicForm.moduleIndex === moduleIndex && <TopicForm newTopicTitle={newTopicTitle} setNewTopicTitle={setNewTopicTitle} newTopicType={newTopicType} setNewTopicType={setNewTopicType} onSubmit={handleSubmitForm} onCancel={cancelTopicForm} />}
        </ul>
      )}
    </li>
  );
}

export default ModuleSection;
