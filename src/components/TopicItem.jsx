import React from 'react';

function TopicItem({ topic, topicIndex, moduleIndex, currentTopic, changeTopic, editorVisible, onRemoveTopic }) {
  function topicIcon(topic) {
    switch (topic.type) {
      case 'video':
        return '🎥';
      case 'quiz':
        return '⏱';
      case 'project':
        return '⚙️';
      default:
        return '-';
    }
  }

  return (
    <li className="mb-0.5 flex justify-between items-center group">
      <div className="flex flex-row">
        <span className="mr-2">{topicIcon(topic)}</span>
        <a onClick={() => changeTopic(topic)} className={`no-underline cursor-pointer truncate max-w-full block whitespace-nowrap overflow-hidden text-ellipsis flex-1 ${topic.path === currentTopic?.path ? 'text-amber-500 font-semibold' : 'text-gray-500 hover:text-amber-500'}`} title={topic.title}>
          {topic.title}
        </a>
        <span className="text-sm align-super text-amber-600">{topic.lastUpdated ? '*' : ''}</span>
      </div>
      {editorVisible && (
        <div className="ml-2 flex items-center">
          <button onClick={() => onRemoveTopic(moduleIndex, topicIndex)} className="font-semibold text-red-600" title="Remove this topic">
            x
          </button>
        </div>
      )}
    </li>
  );
}

export default TopicItem;
