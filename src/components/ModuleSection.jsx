import React from 'react';
import { EditableTopicItem } from './EditableTopicItem';
import TopicItem from './TopicItem';
import TopicForm from './TopicForm';

function ModuleSection({ module, moduleIndex, isOpen, onToggle, currentTopic, changeTopic, editorVisible, showTopicForm, setShowTopicForm, newTopicTitle, setNewTopicTitle, newTopicType, setNewTopicType, onAddTopic, onRenameTopic, onRemoveTopic, cancelTopicForm }) {
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
    <div>
      <li className="mb-1">
        <button onClick={() => onToggle(moduleIndex)} className="no-underline text-gray-500 font-semibold bg-transparent border-none cursor-pointer p-0 truncate max-w-full flex whitespace-nowrap overflow-hidden text-ellipsis items-center" aria-expanded={isOpen} title={module.title}>
          <span className="mr-2">{isOpen ? '▼' : '▶'}</span>
          {module.title}
        </button>
        {isOpen && <ul className="list-none p-0 ml-4">{module.topics.map((topic, topicIndex) => (editorVisible ? <EditableTopicItem key={topic.id} id={topic.id} topic={topic} topicIndex={topicIndex} moduleIndex={moduleIndex} currentTopic={currentTopic} changeTopic={changeTopic} editorVisible={editorVisible} onRemoveTopic={onRemoveTopic} onRenameTopic={onRenameTopic} /> : <TopicItem key={topic.id} topic={topic} currentTopic={currentTopic} changeTopic={changeTopic} />))}</ul>}
        {showTopicForm && showTopicForm.moduleIndex === moduleIndex && <TopicForm newTopicTitle={newTopicTitle} setNewTopicTitle={setNewTopicTitle} newTopicType={newTopicType} setNewTopicType={setNewTopicType} onSubmit={handleSubmitForm} onCancel={cancelTopicForm} />}
      </li>
      {editorVisible && (
        <li className="mb-0.5 flex items-center">
          <button onClick={() => handleAddTopicAfter(moduleIndex, module.topics.length - 1)} className="text-gray-400 hover:text-amber-600 ml-4 text-sm py-1" title="Add new topic to this module">
            + Add topic
          </button>
        </li>
      )}
    </div>
  );
}

export default ModuleSection;
