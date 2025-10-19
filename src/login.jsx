import React, { useState } from 'react';
import service from './service/service';
import { useAlert } from './contexts/AlertContext.jsx';

function Login({ courseOps, setUser }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const { showAlert } = useAlert();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      let user = null;
      if (showSignup) {
        user = await service.register(name, email, password);
        courseOps.addProgress('accountCreation', 'event', 0, { method: 'signup' });
      } else {
        user = await service.login(email, password);
        courseOps.addProgress('userLogin', 'event', 0, { method: 'login' });
      }

      if (user) {
        setUser(user);
      }
    } catch (error) {
      showAlert({ message: `Login failed. Please try again. ${error.message}`, type: 'error' });
    }
  };

  return (
    <div className="flex flex-col items-center justify-center relative bg-white bg-opacity-90 shadow-lg rounded-lg overflow-hidden max-w-md w-full min-h-[354px] px-8 py-2">
      <form className="space-y-4  max-w-md w-full" onSubmit={handleLogin}>
        {showSignup && (
          <div>
            <label className="block text-gray-700 mb-1" htmlFor="name">
              Name
            </label>
            <input
              id="name"
              type="text"
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="Your Name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        )}
        <div>
          <label className="block text-gray-700 mb-1" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-400"
            placeholder="you@example.com"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-gray-700 mb-1" htmlFor="password">
            Password
          </label>

          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-400 pr-10"
              autoComplete={showSignup ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              tabIndex={-1}
              className="absolute inset-y-0 right-2 flex items-center text-gray-500 hover:text-gray-700"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-5.523 0-10-4.477-10-10 0-1.657.336-3.236.938-4.675M15 12a3 3 0 11-6 0 3 3 0 016 0zm6.062-4.675A9.956 9.956 0 0122 9c0 5.523-4.477 10-10 10a9.956 9.956 0 01-4.675-.938M3 3l18 18"
                  />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm7 0c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10z" />
                </svg>
              )}
            </button>
          </div>
        </div>
        <div className="flex space-x-2">
          <button
            type="submit"
            className="flex-1 disabled:bg-gray-300 disabled:hover:bg-gray-300 bg-amber-400 hover:bg-amber-500 text-white font-semibold py-2 rounded transition"
            disabled={!email || !password || (showSignup && !name)}
          >
            {showSignup ? 'Create Account' : 'Log In'}
          </button>
        </div>
      </form>
      <div className="mt-2 text-center">
        {showSignup ? (
          <button type="button" className="text-amber-600 hover:underline text-sm" onClick={() => setShowSignup(false)}>
            Already have an account? Log in
          </button>
        ) : (
          <button type="button" className="text-amber-600 hover:underline text-sm" onClick={() => setShowSignup(true)}>
            Don't have an account? Create one
          </button>
        )}
      </div>
    </div>
  );
}

export default Login;
