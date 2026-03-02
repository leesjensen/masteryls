import React, { useRef, useState } from 'react';
import service from './service/service';
import { useAlert } from './contexts/AlertContext.jsx';
import InputDialog from './hooks/inputDialog.jsx';

function Login({ courseOps }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [showSignup, setShowSignup] = useState(false);
  const { showAlert } = useAlert();
  const otpDialogRef = useRef(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      let user = null;
      if (showSignup) {
        await service.requestOtp(email, name, true);
      } else {
        await service.requestOtp(email, null, false);
      }

      const token = await otpDialogRef.current.show({
        title: 'Enter your code',
        description: `We sent a one-time code to ${email}. Enter it below to access your account.`,
        placeholder: '6-digit code',
        confirmButtonText: 'Verify',
        cancelButtonText: 'Cancel',
      });
      if (!token) {
        return;
      }
      user = await service.verifyOtp(email, token);

      if (user) {
        courseOps.addProgress(user, null, showSignup ? 'accountCreation' : 'userLogin', 0, { method: 'inApp' });

        courseOps.login(user);
      }
    } catch (error) {
      showAlert({ message: `Login failed. Please try again. ${error.message}`, type: 'error' });
    }
  };

  return (
    <div className="flex flex-col items-center justify-center relative bg-white bg-opacity-90 shadow-lg rounded-lg overflow-hidden max-w-md w-full min-h-[354px] px-8 py-2">
      <InputDialog dialogRef={otpDialogRef} />
      <form className="space-y-4  max-w-md w-full" onSubmit={handleLogin}>
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
        <div className="flex space-x-2">
          <button type="submit" className="flex-1 disabled:bg-gray-300 disabled:hover:bg-gray-300 bg-amber-400 hover:bg-amber-500 text-white font-semibold py-2 rounded transition" disabled={!email || (showSignup && !name)}>
            Send Code
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
