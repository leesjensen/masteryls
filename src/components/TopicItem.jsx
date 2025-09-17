import React from 'react';
import { TopicIcon } from './TopicIcon';

function TopicItem({ topic, currentTopic, changeTopic }) {
  return (
    <li className="mb-0.5 flex justify-between items-center group">
      <div className="flex flex-row">
        <span className="mr-2">
          <TopicIcon type={topic.type} />
        </span>
        <a onClick={() => changeTopic(topic)} className={`no-underline cursor-pointer truncate max-w-full block whitespace-nowrap overflow-hidden text-ellipsis flex-1 ${topic.path === currentTopic?.path ? 'text-amber-500 font-semibold' : 'text-gray-500 hover:text-amber-500'}`} title={topic.title}>
          {topic.title}
        </a>
        <span className="text-sm align-super text-amber-600">{topic.lastUpdated ? '*' : ''}</span>
      </div>
    </li>
  );
}

export default TopicItem;
