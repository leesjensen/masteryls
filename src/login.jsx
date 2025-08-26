import React, { useState } from 'react';

function Login({ setUser }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showSignup, setShowSignup] = useState(false);

  const courses = [
    {
      id: 'cs329',
      title: 'QA & DevOps',
      description: 'Description for QA & DevOps',
      progress: 50,
    },
    {
      id: 'cs240',
      title: 'Software Construction',
      description: 'Description for Software Construction',
      progress: 20,
    },
    {
      id: 'cs260',
      title: 'Web Programming',
      description: 'Description for Web Programming',
      progress: 80,
    },
  ];

  const handleLogin = () => {
    if (showSignup) {
      const user = { name, email, password, courses };
      localStorage.setItem('user', JSON.stringify(user));
      setUser(user);
    } else {
      alert('Unknown user or password');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 relative">
      <div className="relative z-10 flex flex-col bg-white bg-opacity-90 shadow-lg rounded-lg overflow-hidden max-w-md w-full p-8">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">💡 Mastery LS</h2>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            handleLogin();
          }}
        >
          {showSignup && (
            <div>
              <label className="block text-gray-700 mb-1" htmlFor="name">
                Name
              </label>
              <input id="name" type="text" className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-400" placeholder="Your Name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          )}
          <div>
            <label className="block text-gray-700 mb-1" htmlFor="email">
              Email
            </label>
            <input id="email" type="email" className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-400" placeholder="you@example.com" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="block text-gray-700 mb-1" htmlFor="password">
              Password
            </label>
            <input id="password" type="password" className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-400" placeholder="••••••••" autoComplete={showSignup ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button type="submit" className="w-full disabled:bg-gray-300 disabled:hover:bg-gray-300 bg-amber-400 hover:bg-amber-500 text-white font-semibold py-2 rounded transition" disabled={!email || !password || (showSignup && !name)}>
            {showSignup ? 'Create Account' : 'Log In'}
          </button>
        </form>
        <div className="mt-4 text-center">
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
    </div>
  );
}

export default Login;
