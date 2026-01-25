import React from 'react';
import { TopicIcon } from './TopicIcon';
import { useNavigate } from 'react-router-dom';

function TopicItem({ course, topic, currentTopic, enrollment }) {
  const navigate = useNavigate();
  const [progressMeter, setProgressMeter] = React.useState(null);

  React.useEffect(() => {
    if (enrollment && topic && topic.interactions && topic.interactions.length > 0) {
      console.log('Calculating progress meter for topic:', topic.id);
      const completedInteractions = enrollment.progress[topic.id] || [];
      setProgressMeter({ completed: completedInteractions.length, total: topic.interactions.length });
    }
  }, [enrollment?.progress[topic.id]]);

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
        </a>
        {progressMeter && (
          <span className="ml-2 text-xs text-gray-400">
            <div className="inline-block w-6 h-3 opacity-75 bg-amber-100 border-1 border-amber-400 rounded-sm overflow-hidden align-middle" title={`${progressMeter.completed}/${progressMeter.total}`}>
              <div className="h-full bg-amber-400 transition-all duration-1000" style={{ width: `${(progressMeter.completed / progressMeter.total) * 100}%` }} />
            </div>
          </span>
        )}
      </div>
    </li>
  );
}

export default TopicItem;
