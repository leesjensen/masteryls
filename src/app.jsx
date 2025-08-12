import React from 'react';
import Instruction from './instruction';
import Contents from './contents';
import loadModules from './moduleLoader';

function App() {
  const title = 'Software Construction';
  const baseUrl = 'https://api.github.com/repos/softwareconstruction240/softwareconstruction/contents';
  const [modules, setModules] = React.useState([]);
  const [topicUrl, setTopicUrl] = React.useState(`${baseUrl}/README.md`);

  React.useEffect(() => {
    loadModules(baseUrl).then((modules) => {
      setModules(modules);
    });
  }, []);

  function navigateTopic(url) {
    console.log('Current topic:', topicUrl);
    console.log('Navigating to topic:', url);
    setTopicUrl(url);
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="h-[32px] bg-red-500 flex items-center px-2">
        <h1 className="text-white text-sm">Mastery LS Frame - {title}</h1>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-[200px] bg-green-700 h-full overflow-hidden">
          <Contents modules={modules} setTopicUrl={navigateTopic} />
        </aside>

        <section className="flex-1 bg-amber-700 overflow-hidden">
          <Instruction topicUrl={topicUrl} />
        </section>
      </div>

      <footer className="h-[32px] bg-gray-200 flex items-center justify-center text-sm">
        <p>Powered by Mastery LS</p>
      </footer>
    </div>
  );
}

export default App;
