import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './src/app.jsx';
import { AlertProvider } from './src/contexts/AlertContext.jsx';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <AlertProvider>
    <App />
  </AlertProvider>
);
