import React, { useState, useEffect } from 'react';
import useHotkeys from './hooks/useHotKeys';

function Contents({ service, changeTopic, currentTopic, course, enrollment, navigateToAdjacentTopic }) {
  const [openModuleIndexes, setOpenModuleIndexes] = useState([]);

  useHotkeys(
    {
      'ALT+ArrowRight': (e) => {
        navigateToAdjacentTopic('next');
      },
      'ALT+ArrowLeft': (e) => {
        navigateToAdjacentTopic('prev');
      },
    },
    { target: undefined }
  );

  const toggleModule = (index) => {
    setOpenModuleIndexes((prev) => {
      const newIndexes = prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index];

      enrollment.settings.tocIndexes = newIndexes;
      service.saveEnrollment(enrollment);

      return newIndexes;
    });
  };

  useEffect(() => {
    if (currentTopic?.path) {
      const moduleIndex = course.moduleIndexOf(currentTopic.path);
      if (moduleIndex !== -1 && !enrollment.settings.tocIndexes.includes(moduleIndex)) {
        enrollment.settings.tocIndexes.push(moduleIndex);
        service.saveEnrollment(enrollment);
      }
    }
    setOpenModuleIndexes(enrollment.settings.tocIndexes);
  }, [currentTopic]);

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

  if (!course) {
    return <div className="p-4 text-gray-500"></div>;
  }

  return (
    <div id="content" className="h-full overflow-auto p-4 text-sm">
      <nav>
        <ul className="list-none p-0">
          {course.map((item, i) => (
            <li key={i} className="mb-1">
              <button onClick={() => toggleModule(i)} className="no-underline text-gray-500 font-semibold bg-transparent border-none cursor-pointer p-0 truncate max-w-full flex whitespace-nowrap overflow-hidden text-ellipsis items-center" aria-expanded={openModuleIndexes.includes(i)} title={item.title}>
                <span className="mr-2">{openModuleIndexes.includes(i) ? '▼' : '▶'}</span>
                {item.title}
              </button>
              {openModuleIndexes.includes(i) && (
                <ul className="list-none p-0 ml-4">
                  {item.topics.map((topic) => (
                    <li key={topic.path} className="mb-0.5 flex items-center">
                      <span className="mr-2">{topicIcon(topic)}</span>
                      <a onClick={() => changeTopic(topic)} className={`no-underline cursor-pointer truncate max-w-full block whitespace-nowrap overflow-hidden text-ellipsis ${topic.path === currentTopic?.path ? 'text-amber-500 font-semibold' : 'text-gray-500 hover:text-amber-500'}`} title={topic.title}>
                        {topic.title}
                      </a>
                      <span className="text-sm align-super text-amber-600">{topic.lastUpdated ? '*' : ''}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

export default Contents;
