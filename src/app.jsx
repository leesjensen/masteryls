import React, { useState } from 'react';
import config from '../config.js';
import Instruction from './instruction';
import Sidebar from './sidebar';
import loadModules from './moduleLoader';

config.links = {
  gitHub: {
    url: `https://github.com/${config.github.account}/${config.github.repository}/blob/main`,
    apiUrl: `https://api.github.com/repos/${config.github.account}/${config.github.repository}/contents`,
    rawUrl: `https://raw.githubusercontent.com/${config.github.account}/${config.github.repository}/main`,
  },
  schedule: `https://api.github.com/repos/${config.github.account}/${config.github.repository}/contents/${config.course.schedule}`,
  syllabus: `https://api.github.com/repos/${config.github.account}/${config.github.repository}/contents/${config.course.syllabus}`,
};

function App() {
  const [modules, setModules] = React.useState([]);
  const [topic, setTopic] = React.useState({ title: '', path: '' });
  const [sidebarVisible, setSidebarVisible] = useState(getSidebarPreference());

  React.useEffect(() => {
    loadModules(config, config.links.gitHub.apiUrl).then((modules) => {
      setModules(modules);

      const savedTopic = localStorage.getItem('selectedTopic');
      if (savedTopic) {
        setTopic(JSON.parse(savedTopic));
      } else {
        setTopic({ title: 'Home', path: `${config.links.gitHub.apiUrl}/README.md` });
      }
    });
  }, []);

  function getSidebarPreference() {
    const sidebarPref = localStorage.getItem('sidebarVisible');
    if (sidebarPref !== null) {
      return sidebarPref === 'true';
    } else {
      return true;
    }
  }

  function manipulateSidebar(visible) {
    setSidebarVisible(visible);
    localStorage.setItem('sidebarVisible', visible);
  }

  function navigateTopic(newTopic) {
    localStorage.setItem('selectedTopic', JSON.stringify(newTopic));
    setTopic(newTopic);

    if (sidebarVisible && window.innerWidth < 768) {
      manipulateSidebar(false);
    }
  }

  function navigateToAdjacentTopic(direction = 'prev') {
    const allTopics = modules.flatMap((module) =>
      module.topics.map((t, idx) => ({
        ...t,
        moduleIndex: modules.indexOf(module),
        topicIndex: idx,
      }))
    );
    const currentIndex = allTopics.findIndex((t) => t.path === topic.path);

    if (direction === 'prev' && currentIndex > 0) {
      navigateTopic(allTopics[currentIndex - 1]);
    } else if (direction === 'next' && currentIndex < allTopics.length - 1) {
      navigateTopic(allTopics[currentIndex + 1]);
    }
  }

  function gitHubUrl(url) {
    return url.replace(config.links.gitHub.apiUrl, config.links.gitHub.url);
  }

  function displaySchedule() {
    manipulateSidebar(false);
    setTopic({ name: 'Schedule', path: config.links.schedule });
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="items-center px-2 mb-1 border-b-1 py-2 bg-amber-300 border-gray-200 hidden sm:block ">
        <h1 className="font-semibold text-lg text-gray-700">💡 {config.course.title}</h1>
      </header>

      <div className="flex flex-row justify-between border-b-1 border-gray-200">
        <div className="flex flex-row justify-start">
          <div className="sm:hidden flex justify-center items-center w-[32px] bg-amber-300 ">💡</div>
          <button className="w-12 m-1 px-2 py-1 text-xs border rounded hover:bg-amber-300" onClick={() => manipulateSidebar(!sidebarVisible)}>
            {sidebarVisible ? '☰ ◀' : '☰ ▶'}
          </button>
        </div>
        <div className="flex flex-row justify-end">
          <button className="w-12 m-1 px-2 py-1 text-xs border rounded hover:bg-amber-300" onClick={() => navigateToAdjacentTopic('prev')}>
            Prev
          </button>
          <button className="w-12 m-1 px-2 py-1 text-xs border rounded hover:bg-amber-300 flex items-center justify-center" onClick={() => window.open(gitHubUrl(topic.path), '_blank')}>
            <svg width="16" height="16" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8C0 11.54 2.29 14.53 5.47 15.59C5.87 15.66 6.02 15.42 6.02 15.21C6.02 15.02 6.01 14.39 6.01 13.72C4 14.09 3.48 13.23 3.32 12.78C3.23 12.55 2.84 11.84 2.5 11.65C2.22 11.5 1.82 11.13 2.49 11.12C3.12 11.11 3.57 11.7 3.72 11.94C4.44 13.15 5.59 12.81 6.05 12.6C6.12 12.08 6.33 11.73 6.56 11.53C4.78 11.33 2.92 10.64 2.92 7.58C2.92 6.71 3.23 5.99 3.74 5.43C3.66 5.23 3.38 4.41 3.82 3.31C3.82 3.31 4.49 3.1 6.02 4.13C6.66 3.95 7.34 3.86 8.02 3.86C8.7 3.86 9.38 3.95 10.02 4.13C11.55 3.09 12.22 3.31 12.22 3.31C12.66 4.41 12.38 5.23 12.3 5.43C12.81 5.99 13.12 6.7 13.12 7.58C13.12 10.65 11.25 11.33 9.47 11.53C9.76 11.78 10.01 12.26 10.01 13.01C10.01 14.08 10 14.94 10 15.21C10 15.42 10.15 15.67 10.55 15.59C13.71 14.53 16 11.53 16 8C16 3.58 12.42 0 8 0Z" transform="scale(64)" fill="#1B1F23" />
            </svg>
          </button>
          <button className="w-12 m-1 px-2 py-1 text-xs border rounded hover:bg-amber-300" onClick={() => displaySchedule()}>
            📅
          </button>
          <button className="w-12 m-1 px-2 py-1 text-xs border rounded hover:bg-amber-300" onClick={() => navigateToAdjacentTopic('next')}>
            Next
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className={sidebarVisible ? 'flex  w-full sm:w-[300px]' : 'hidden'}>
          <Sidebar config={config} modules={modules} currentTopic={topic} setTopic={navigateTopic} />
        </div>
        <Instruction config={config} topicUrl={topic.path} setTopic={navigateTopic} />
      </div>
    </div>
  );
}

export default App;
