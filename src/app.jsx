import React, { useState } from 'react';
import Instruction from './instruction';
import Sidebar from './sidebar';
import loadModules from './moduleLoader';

function App({ config }) {
  const baseUrl = `https://api.github.com/repos/${config.github.account}/${config.github.repository}/contents`;
  const [modules, setModules] = React.useState([]);
  const [topic, setTopic] = React.useState({ title: '', path: '' });
  const [sidebarVisible, setSidebarVisible] = useState(true);

  React.useEffect(() => {
    loadModules(config, baseUrl).then((modules) => {
      setModules(modules);

      const savedTopic = localStorage.getItem('selectedTopic');
      if (savedTopic) {
        setTopic(JSON.parse(savedTopic));
      } else {
        setTopic({ title: 'Home', path: `${baseUrl}/README.md` });
      }
    });
  }, []);

  function navigateTopic(newTopic) {
    localStorage.setItem('selectedTopic', JSON.stringify(newTopic));
    setTopic(newTopic);
  }

  function gitHubUrl(url) {
    return url.replace(baseUrl, `https://github.com/${config.github.account}/${config.github.repository}/blob/main`);
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="h-[32px] flex items-center px-2 rounded-xs m-1 border border-gray-200">
        <h1 className="text-lg text-gray-700">💡 {config.course.title}</h1>
      </header>

      <button className="w-10 ml-2 px-2 py-1 text-xs border rounded hover:bg-gray-100" onClick={() => setSidebarVisible(!sidebarVisible)}>
        {sidebarVisible ? '◀' : '▶'}
      </button>

      <div className="flex flex-1 overflow-hidden">
        {sidebarVisible && <Sidebar modules={modules} setTopic={navigateTopic} />}
        <Instruction config={config} topicUrl={topic.path} />
      </div>

      <footer className="h-[32px] bg-gray-200 flex items-center justify-evenly text-sm">
        <span className="text-gray-600">prev</span>
        <a href={gitHubUrl(topic.path)} className="ml-2 text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
          View on GitHub
        </a>
        <span className="text-gray-600">next</span>
      </footer>
    </div>
  );
}

export default App;
