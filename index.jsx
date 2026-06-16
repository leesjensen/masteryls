import React from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { createAppRouter } from './src/app.jsx';
import service from './src/service/service.js';
import { AlertProvider } from './src/contexts/AlertContext.jsx';
import { ProgressProvider } from './src/contexts/ProgressContext.jsx';
import { registerSW } from 'virtual:pwa-register';

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

const updateSW = registerSW({
  onOfflineReady() {
    window.dispatchEvent(new Event('pwa-offline-ready'));
  },
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent('pwa-update-available', { detail: { updateSW } }));
  },
});

function LoadingPage() {
  return (
    <div className="mt-16 flex min-h-dvh items-center justify-center bg-gradient-to-br from-gray-50to-gray-200">
      <div className="text-center">
        <div className="inline-block">
          <div className="w-16 h-16 border-8 border-amber-200 border-t-amber-600 rounded-full animate-spin mx-auto mb-4"></div>
        </div>
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">Mastery LS is Loading</h2>
        <p className="text-gray-600">
          {!navigator.onLine ? 'You appear to be offline. Reconnect to load course content and continue working.' : 'It is taking longer than expected to load your content. If this continues please contact '}
          {navigator.onLine && (
            <>
              <a href="mailto:support@masterls.com" className="text-blue-600 hover:underline">
                customer support.
              </a>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
