import React from 'react';
import ReactDOM from 'react-dom/client';

import Instruction from './src/instruction.jsx';

function App() {
  return (
    <div>
      Mastery LS Frame
      <Instruction />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
