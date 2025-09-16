import React from 'react';

function TopicItem({ 
  topic, 
  topicIndex, 
  moduleIndex,
  currentTopic, 
  changeTopic, 
  editorVisible,
  onAddTopic,
  onRemoveTopic 
}) {
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
    <li className="mb-0.5 flex items-center group">
      <span className="mr-2">{topicIcon(topic)}</span>
      <a 
        onClick={() => changeTopic(topic)} 
        className={`no-underline cursor-pointer truncate max-w-full block whitespace-nowrap overflow-hidden text-ellipsis flex-1 ${
          topic.path === currentTopic?.path 
            ? 'text-amber-500 font-semibold' 
            : 'text-gray-500 hover:text-amber-500'
        }`} 
        title={topic.title}
      >
        {topic.title}
      </a>
      <span className="text-sm align-super text-amber-600">
        {topic.lastUpdated ? '*' : ''}
      </span>
      {editorVisible && (
        <div className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
          <button 
            onClick={() => onAddTopic(moduleIndex, topicIndex)} 
            className="text-gray-400 hover:text-green-600 mr-1 text-xs" 
            title="Add topic after this one"
          >
            ➕
          </button>
          <button 
            onClick={() => onRemoveTopic(moduleIndex, topicIndex)} 
            className="text-gray-400 hover:text-red-600 text-xs" 
            title="Remove this topic"
          >
            ❌
          </button>
        </div>
      )}
    </li>
  );
}

export default TopicItem;
