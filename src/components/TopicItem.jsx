import React from 'react';
import { BadgeCheck, StickyNote } from 'lucide-react';

import { TopicIcon } from '../utils/Icons';
import { useNavigate } from 'react-router-dom';

function TopicItem({ course, topic, currentTopic, enrollment }) {
  const navigate = useNavigate();
  const [progressMeter, setProgressMeter] = React.useState(null);

  React.useEffect(() => {
    if (enrollment && enrollment.progress) {
      if (topic.interactions && topic.interactions.length > 0) {
        const completedInteractions = enrollment?.progress[topic.id]?.interactions || [];
        setProgressMeter({ completed: completedInteractions.length, total: topic.interactions.length });
      } else if (enrollment.progress[topic.id]) {
        setProgressMeter({ completed: 1, total: 1 });
      }
    }
  }, [enrollment?.progress[topic.id]?.interactions]);

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
        <a
          href={`/course/${course.id}/topic/${topic.id}`}
          onClick={(e) => {
            if (!e.metaKey && !e.ctrlKey && !e.shiftKey) {
              e.preventDefault();
              navigate(`/course/${course.id}/topic/${topic.id}`);
            }
          }}
          className={`mr-1 no-underline cursor-pointer truncate max-w-full block whitespace-nowrap overflow-hidden text-ellipsis flex-1 ${topic.path === currentTopic?.path ? 'text-amber-500' : 'text-gray-500 hover:text-amber-500'}`}
          title={topic.title}
        >
          {topic.title}
        </a>
        {enrollment?.progress[topic.id]?.notes && (
          <span className="text-blue-300 mr-1">
            <StickyNote size={16} />
          </span>
        )}
        {progressMeter && (
          <span className="text-xs text-gray-400 flex items-center mr-1">
            {progressMeter.completed === progressMeter.total ? (
              <span className="animate-fade-in text-blue-400" title="Studied">
                <BadgeCheck size={14} />
              </span>
            ) : (
              <div className="inline-block w-6 h-1.5 opacity-75 bg-blue-100 border-1 border-blue-400 rounded-sm overflow-hidden align-middle" title={`${progressMeter.completed}/${progressMeter.total}`}>
                <div className="h-full bg-blue-400 transition-all duration-1000" style={{ width: `${(progressMeter.completed / progressMeter.total) * 100}%` }} />
              </div>
            )}
          </span>
        )}
      </div>
    </li>
  );
}

export default TopicItem;
