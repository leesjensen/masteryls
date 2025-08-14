import React, { useState } from 'react';
import config from '../config.js';
import Toolbar from './toolbar';
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

  function toggleEditor() {
    console.log('toggle editor');
  }

  return (
    <div className='flex flex-col h-screen'>
      <header className='items-center px-2 mb-1 border-b-1 py-2 bg-amber-200 border-gray-200 hidden sm:block '>
        <h1 className='font-semibold text-lg text-gray-700'>💡 {config.course.title}</h1>
      </header>

      <Toolbar
        config={config}
        sidebarVisible={sidebarVisible}
        manipulateSidebar={manipulateSidebar}
        topic={topic}
        setTopic={setTopic}
        navigateToAdjacentTopic={navigateToAdjacentTopic}
        toggleEditor={toggleEditor}
      />

      <div className='flex flex-1 overflow-hidden'>
        <div className={`transition-all duration-300 ease-in-out overflow-hidden ${sidebarVisible ? 'flex w-full sm:w-[300px] opacity-100' : 'w-0 opacity-0'}`}>
          <Sidebar config={config} modules={modules} currentTopic={topic} setTopic={navigateTopic} />
        </div>
        <Instruction config={config} topic={topic} setTopic={navigateTopic} modules={modules} navigateToAdjacentTopic={navigateToAdjacentTopic} />
      </div>
    </div>
  );
}

export default App;
