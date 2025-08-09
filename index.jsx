import React from 'react';
import ReactDOM from 'react-dom/client';

import Instruction from './src/instruction.jsx';

function App() {
  return (
    <>
      <header>
        <h1>Mastery LS Frame</h1>
      </header>
      <main>
        <Instruction />
      </main>
      <footer>
        <p>Powered by Mastery LS</p>
      </footer>
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
