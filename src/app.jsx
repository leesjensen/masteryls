import React from 'react';
import Instruction from './instruction';

function App() {
  const title = 'Software Construction';

  return (
    <div className="flex flex-col h-screen">
      <header className="h-[32px] bg-red-500 flex items-center px-2">
        <h1 className="text-white text-sm">Mastery LS Frame - {title}</h1>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-[200px] bg-green-700 h-full overflow-auto p-2">
          <div className="text-white space-y-2">
            {Array.from({ length: 100 }, (_, i) => (
              <p key={i}>TOC {i + 1}</p>
            ))}
          </div>
        </aside>

        <section className="flex-1 bg-amber-700 overflow-hidden">
          <div id="content" className="h-full overflow-auto">
            <Instruction />
          </div>
        </section>
      </div>

      <footer className="h-[32px] bg-gray-200 flex items-center justify-center text-sm">
        <p>Powered by Mastery LS</p>
      </footer>
    </div>
  );
}

export default App;
