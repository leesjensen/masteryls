import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './src/app.jsx';
import config from './config.js';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App config={config} />);
