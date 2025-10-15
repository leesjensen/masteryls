import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './src/app.jsx';
import { AlertProvider } from './src/contexts/AlertContext.jsx';
import { ProgressProvider } from './src/contexts/ProgressContext.jsx';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <AlertProvider>
    <ProgressProvider>
      <App />
    </ProgressProvider>
  </AlertProvider>
);
