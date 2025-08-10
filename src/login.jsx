import React, { useState } from 'react';

function Login() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [input, setInput] = useState('');

  const handleLogin = () => {
    if (input.trim()) {
      setUsername(input.trim());
      setLoggedIn(true);
      setInput('');
    }
  };

  const handleLogout = () => {
    setLoggedIn(false);
    setUsername('');
  };

  return (
    <div className="w-50 mt-2 p-2 bg-white rounded shadow">
      <h2 className="text-lg font-bold mb-2">Login</h2>
      {loggedIn ? (
        <div className="flex flex-row gap-2">
          <button className="text-sm p-2 bg-red-500 text-white rounded hover:bg-red-600 transition" onClick={handleLogout}>
            Logout
          </button>
          <p className="text-sm p-1">
            <strong>{username}</strong>
          </p>
        </div>
      ) : (
        <div className="flex flex-row gap-2">
          <button className="text-sm p-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition" onClick={handleLogin}>
            Login
          </button>
          <input
            className=" flex-1 min-w-0 p-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            type="text"
            placeholder="Username"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

export default Login;
