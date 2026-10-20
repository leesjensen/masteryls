import React from 'react';
import { BadgeCheck, StickyNote } from 'lucide-react';

import { TopicIcon } from '../utils/Icons';
import { completedInteractionIds } from '../utils/topicProgress';
import { handleSidebarLinkClick } from '../utils/linkNavigation';
import { useNavigate } from 'react-router-dom';

// Left-border + tint accents that mirror the schedule's orange "today" / blue "next" row
// highlighting. The orange/blue Tailwind tokens are remapped for dark mode in dark.css, so these
// adapt automatically.
const SCHEDULE_STATUS_STYLES = {
  today: { className: 'border-l-2 border-orange-400 bg-orange-50 pl-1 rounded-sm', title: 'Covered in today’s session' },
  next: { className: 'border-l-2 border-blue-400 bg-blue-50 pl-1 rounded-sm', title: 'Covered in the next session' },
};

function TopicItem({ course, topic, currentTopic, enrollment, courseOps, dueDateLabel = '', scheduleStatus = '', headings = [] }) {
  const navigate = useNavigate();
  const [progressMeter, setProgressMeter] = React.useState(null);

  React.useEffect(() => {
    if (enrollment && enrollment.progress) {
      if (topic.interactions && topic.interactions.length > 0) {
        const completedInteractions = completedInteractionIds(enrollment?.progress?.[topic.id]);
        setProgressMeter({ completed: completedInteractions.length, total: topic.interactions.length });
      } else if (enrollment.progress[topic.id]) {
        setProgressMeter({ completed: 1, total: 1 });
      }
    }
  }, [enrollment?.progress[topic.id]?.scores, enrollment?.progress[topic.id]?.interactions]);

  function navigateToTopic(e, anchor) {
    handleSidebarLinkClick(e, {
      courseOps,
      courseId: course.id,
      navigate,
      to: `/course/${course.id}/topic/${topic.id}${anchor ? `#${anchor}` : ''}`,
    });
  }

  const scheduleAccent = SCHEDULE_STATUS_STYLES[scheduleStatus];
  const isCurrent = topic.path === currentTopic?.path;

  return (
    <li className={`mb-0.5 group min-w-0 w-full ${scheduleAccent ? scheduleAccent.className : ''}`.trim()} title={scheduleAccent?.title || undefined}>
      <div className="flex flex-row items-center min-w-0 w-full">
        {topic.state && topic.state !== 'published' && (
          <span className="text-xs text-white bg-gray-500 rounded px-1 mr-1 shrink-0" title={`This topic is in "${topic.state}" state`}>
            {topic.state}
          </span>
        )}
        <span className="mr-2 shrink-0">
          <TopicIcon type={topic.type} />
        </span>
        <a href={`/course/${course.id}/topic/${topic.id}`} onClick={navigateToTopic} className={`mr-1 no-underline cursor-pointer truncate min-w-0 max-w-full block whitespace-nowrap overflow-hidden text-ellipsis flex-1 ${topic.path === currentTopic?.path ? 'text-amber-500' : 'text-gray-500 hover:text-amber-500'}`} title={topic.title}>
          {topic.title}
        </a>
        {enrollment?.progress[topic.id]?.notes && (
          <a className="text-blue-300 mr-1 shrink-0" onClick={(e) => navigateToTopic(e, '@note')}>
            <StickyNote size={16} />
          </a>
        )}
        {progressMeter && (
          <span className="text-xs text-gray-400 flex items-center mr-1 shrink-0">
            {progressMeter.completed >= progressMeter.total ? (
              <span className="animate-fade-in text-blue-400" title="Studied">
                <BadgeCheck size={14} />
              </span>
            ) : (
              <div className="inline-block w-6 h-1.5 opacity-75 bg-blue-100 border-1 border-blue-400 overflow-hidden align-middle" title={`${progressMeter.completed}/${progressMeter.total}`}>
                <div className="h-full bg-blue-400 transition-all duration-1000" style={{ width: `${(progressMeter.completed / progressMeter.total) * 100}%` }} />
              </div>
            )}
          </span>
        )}
        {dueDateLabel && (
          <span className="inline-flex items-center justify-center w-[30px] text-[10px] text-blue-400  border-gray-200/70 px-1 mr-1 whitespace-nowrap shrink-0" title={`Due ${dueDateLabel}`}>
            {dueDateLabel}
          </span>
        )}
      </div>
      {/* Jump-list of the current topic's level-2 headings, so the learner can hop around
          within the topic. Only rendered for the topic being viewed. */}
      {isCurrent && headings.length > 0 && (
        <ul className="list-none mt-0.5 mb-1 ml-5 pl-2 border-l border-gray-200">
          {headings.map((heading, index) => (
            <li key={`${heading.slug}-${index}`} className="mb-0.5 min-w-0">
              <a
                href={`/course/${course.id}/topic/${topic.id}#${heading.slug}`}
                onClick={(e) => handleSidebarLinkClick(e, { courseOps, courseId: course.id, navigate, to: `/course/${course.id}/topic/${topic.id}#${heading.slug}` })}
                className="block truncate no-underline cursor-pointer text-xs text-gray-400 hover:text-amber-500"
                title={heading.text}
              >
                {heading.text}
              </a>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default TopicItem;
