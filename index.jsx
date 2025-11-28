import React from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { createAppRouter } from './src/app.jsx';
import service from './src/service/service.js';
import { AlertProvider } from './src/contexts/AlertContext.jsx';
import { ProgressProvider } from './src/contexts/ProgressContext.jsx';

const container = document.getElementById('root');
const root = createRoot(container);

// Show a loading page if loading the app is delayed
root.render(null);
const loadingTimer = setTimeout(() => {
  root.render(<LoadingPage />);
}, 1000);

async function loadApp() {
  let user = null;
  try {
    user = await service.currentUser();
  } catch (err) {
    user = null;
  }

  const router = createAppRouter(user);

  clearTimeout(loadingTimer);

  root.render(
    <AlertProvider>
      <ProgressProvider>
        <RouterProvider router={router} />
      </ProgressProvider>
    </AlertProvider>
  );
}

loadApp();

function LoadingPage() {
  return (
    <div className="mt-16 flex items-center justify-center h-full bg-gradient-to-br from-gray-50to-gray-200">
      <div className="text-center">
        <div className="inline-block">
          <div className="w-16 h-16 border-8 border-amber-200 border-t-amber-600 rounded-full animate-spin mx-auto mb-4"></div>
        </div>
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">Mastery LS is Loading</h2>
        <p className="text-gray-600">
          It is taking longer than expected to load your content. If this continues please contact{' '}
          <a href="mailto:support@masterls.com" className="text-blue-600 hover:underline">
            customer support.
          </a>
        </p>
      </div>
    </div>
  );
}
