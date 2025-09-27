import React from 'react';
import { EditableTopicItem } from './EditableTopicItem';
import TopicItem from './TopicItem';
import NewTopicButton from './NewTopicButton';

function ModuleSection({ courseOps, module, moduleIndex, isOpen, onToggle, currentTopic, editorVisible }) {
  function getTopicItem(topic, topicIndex) {
    if (editorVisible) {
      return <EditableTopicItem key={topic.id} id={topic.id} courseOps={courseOps} topic={topic} topicIndex={topicIndex} moduleIndex={moduleIndex} currentTopic={currentTopic} editorVisible={editorVisible} />;
    }
    return <TopicItem key={topic.id} courseOps={courseOps} topic={topic} currentTopic={currentTopic} />;
  }
  return (
    <div>
      <li className="mb-1">
        <button onClick={() => onToggle(moduleIndex)} className="no-underline text-gray-500 font-semibold bg-transparent border-none cursor-pointer p-0 truncate max-w-full flex whitespace-nowrap overflow-hidden text-ellipsis items-center" aria-expanded={isOpen} title={module.title}>
          <span className="mr-2">{isOpen ? '▼' : '▶'}</span>
          {module.title}
        </button>
        {isOpen && (
          <ul className="list-none p-0 ml-4">
            {module.topics.map((topic, topicIndex) => getTopicItem(topic, topicIndex))}
            {editorVisible && (
              <li className="mb-0.5 flex items-center">
                <NewTopicButton moduleIndex={moduleIndex} courseOps={courseOps} />
              </li>
            )}
          </ul>
        )}
      </li>
    </div>
  );
}

export default ModuleSection;
