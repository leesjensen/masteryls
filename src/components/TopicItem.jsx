import React, { useState } from 'react';
import { TopicIcon } from './TopicIcon';

function TopicItem({ topic, currentTopic, changeTopic, setShowEditForm }) {
  return (
    <li className="mb-0.5 flex justify-between items-center group">
      <div className="flex flex-row">
        {topic.state && topic.state !== 'stable' && (
          <span onClick={() => setShowEditForm(true)} className="text-xs text-white bg-gray-500 rounded px-1 mr-1 cursor-pointer" title={`This topic is in "${topic.state}" state`}>
            {topic.state}
          </span>
        )}
        <span className="mr-2">
          <TopicIcon type={topic.type} />
        </span>
        <a onClick={() => changeTopic(topic)} className={`no-underline cursor-pointer truncate max-w-full block whitespace-nowrap overflow-hidden text-ellipsis flex-1 ${topic.path === currentTopic?.path ? 'text-amber-500 font-semibold' : 'text-gray-500 hover:text-amber-500'}`} title={topic.title}>
          {topic.title}
        </a>
      </div>
    </li>
  );
}

export default TopicItem;
