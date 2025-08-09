import React from 'react';

import Instruction from './instruction.jsx';

function App({ title }) {
  return (
    <>
      <header className="fixed top-0 left-0 w-full bg-gray-200 p-2 z-10 shadow">
        <h1>Mastery LS Frame - {title}</h1>
      </header>
      <main className="p-4 m-4 pt-16">
        <Instruction />
      </main>
      <footer className="bg-gray-200 p-2 text-center">
        <p>Powered by Mastery LS</p>
      </footer>
    </>
  );
}

export default App;
