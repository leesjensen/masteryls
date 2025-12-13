import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function ErrorPage({ user, message }) {
  const navigate = useNavigate();
  const location = useLocation();
  const path = user ? '/dashboard' : '/';

  const errorMessage = location.state?.error;

  return (
    <div className="flex flex-col items-center justify-center text-center h-screen p-4">
      <h1 className="text-3xl font-bold text-amber-500 mb-4">{message || 'An unexpected error occurred'}</h1>
      <p className="text-lg text-gray-500 mb-6">{errorMessage || 'Please try navigating back to the home page.'}</p>

      <div className="space-x-4">
        <button onClick={() => navigate(path, { replace: true })} className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
          Go Home
        </button>
      </div>
    </div>
  );
}
