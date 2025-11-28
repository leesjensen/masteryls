import React, { useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import { createRouter } from './rootLayout.jsx';
import service from './service/service.js';

function App() {
  const [user, setUser] = useState(undefined);
  const [showLoading, setShowLoading] = useState(false);
  console.log('App render', { user });

  React.useEffect(() => {
    service.currentUser().then((u) => setUser(u));
  }, []);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setShowLoading(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const router = React.useMemo(() => createRouter(user), [user]);

  if (user === undefined) {
    return showLoading ? <LoadingPage /> : null;
  }

  return <RouterProvider router={router} />;
}

function LoadingPage() {
  return (
    <div className="flex items-center justify-center h-full bg-gradient-to-br from-gray-50to-gray-200">
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

export default App;
