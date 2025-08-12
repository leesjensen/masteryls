import React, { useState, useEffect } from 'react';

function Contents({ setTopic, currentTopic, modules }) {
  const [openModuleIndexes, setOpenModuleIndexes] = useState([]);

  const toggleModule = (index) => {
    setOpenModuleIndexes((prev) => {
      const newIndexes = prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index];
      localStorage.setItem('tocIndexes', JSON.stringify(newIndexes));
      return newIndexes;
    });
  };

  useEffect(() => {
    const indexes = JSON.parse(localStorage.getItem('tocIndexes') || '[0]');
    if (currentTopic?.path) {
      const moduleIndex = modules.findIndex((mod) => mod.topics.some((topic) => topic.path === currentTopic.path));
      if (moduleIndex !== -1 && !indexes.includes(moduleIndex)) {
        indexes.push(moduleIndex);
        localStorage.setItem('tocIndexes', JSON.stringify(indexes));
      }
    }
    setOpenModuleIndexes(indexes);
  }, [currentTopic]);

  return (
    <div id="content" className="h-full overflow-auto  p-4 text-sm">
      <nav>
        <ul className="list-none p-0">
          {modules.map((item, i) => (
            <li key={i} className="mb-1">
              <button onClick={() => toggleModule(i)} className="no-underline text-gray-800 font-bold hover:text-blue-600 bg-transparent border-none cursor-pointer p-0 truncate max-w-full block whitespace-nowrap overflow-hidden text-ellipsis" aria-expanded={openModuleIndexes.includes(i)} title={item.title}>
                <span style={{ marginRight: 8 }}>{openModuleIndexes.includes(i) ? '▼' : '▶'}</span>
                {item.title}
              </button>
              {openModuleIndexes.includes(i) && (
                <ul className="list-none p-0 ml-4">
                  {item.topics.map((topic, j) => (
                    <li key={j} className="mb-1 flex items-center">
                      <span style={{ marginRight: 8, fontSize: '1.1em' }}>-</span>
                      <a onClick={() => setTopic({ title: topic.title, path: topic.path })} className={`no-underline cursor-pointer truncate max-w-full block whitespace-nowrap overflow-hidden text-ellipsis ${topic.path === currentTopic?.path ? 'text-amber-300 font-semibold' : 'text-gray-500 hover:text-blue-600'}`} title={topic.title}>
                        {topic.title}
                      </a>
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
