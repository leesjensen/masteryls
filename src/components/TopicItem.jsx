import React from 'react';
import { TopicIcon } from './TopicIcon';
import { useNavigate } from 'react-router-dom';

function TopicItem({ course, topic, currentTopic }) {
  const navigate = useNavigate();

  return (
    <li className="mb-0.5 flex justify-between items-center group">
      <div className="flex flex-row">
        {topic.state && topic.state !== 'published' && (
          <span className="text-xs text-white bg-gray-500 rounded px-1 mr-1" title={`This topic is in "${topic.state}" state`}>
            {topic.state}
          </span>
        )}
        <span className="mr-2">
          <TopicIcon type={topic.type} />
        </span>
        <a onClick={() => navigate(`/course/${course.id}/topic/${topic.id}`)} className={`no-underline cursor-pointer truncate max-w-full block whitespace-nowrap overflow-hidden text-ellipsis flex-1 ${topic.path === currentTopic?.path ? 'text-amber-500 font-semibold' : 'text-gray-500 hover:text-amber-500'}`} title={topic.title}>
          {topic.title}
          {!!topic.interactions?.length && ` ✨`}
        </a>
      </div>
    </li>
  );
}

export default TopicItem;
