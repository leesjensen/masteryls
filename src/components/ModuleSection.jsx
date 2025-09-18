import React from 'react';
import { EditableTopicItem } from './EditableTopicItem';
import TopicItem from './TopicItem';
import NewTopicButton from './NewTopicButton';

function ModuleSection({ module, moduleIndex, isOpen, onToggle, currentTopic, changeTopic, editorVisible, courseOps }) {
  return (
    <div>
      <li className="mb-1">
        <button onClick={() => onToggle(moduleIndex)} className="no-underline text-gray-500 font-semibold bg-transparent border-none cursor-pointer p-0 truncate max-w-full flex whitespace-nowrap overflow-hidden text-ellipsis items-center" aria-expanded={isOpen} title={module.title}>
          <span className="mr-2">{isOpen ? '▼' : '▶'}</span>
          {module.title}
        </button>
        {isOpen && <ul className="list-none p-0 ml-4">{module.topics.map((topic, topicIndex) => (editorVisible ? <EditableTopicItem key={topic.id} id={topic.id} topic={topic} topicIndex={topicIndex} moduleIndex={moduleIndex} currentTopic={currentTopic} changeTopic={changeTopic} editorVisible={editorVisible} courseOps={courseOps} /> : <TopicItem key={topic.id} topic={topic} currentTopic={currentTopic} changeTopic={changeTopic} />))}</ul>}
      </li>
      {editorVisible && (
        <li className="mb-0.5 ml-4 flex items-center">
          <NewTopicButton moduleIndex={moduleIndex} courseOps={courseOps} />
        </li>
      )}
    </div>
  );
}

export default ModuleSection;
