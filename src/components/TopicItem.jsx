import React from 'react';

function TopicItem({ topic, topicIndex, moduleIndex, currentTopic, changeTopic, editorVisible, onRemoveTopic }) {
  function topicIcon(topic) {
    switch (topic.type) {
      case 'video':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        );
      case 'quiz':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
        );
      case 'project':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <rect x="3" y="7" width="18" height="16" rx="2" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7l9-4 9 4" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 13h8M8 17h5" />
          </svg>
        );
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0013.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        );
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
