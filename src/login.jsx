import React, { useRef, useState } from 'react';
import service from './service/service';
import { useAlert } from './contexts/AlertContext.jsx';
import InputDialog from './hooks/inputDialog.jsx';

// Email domains allowed to create a new account. Add an entry here to allow another domain.
const ALLOWED_SIGNUP_EMAIL_PATTERNS = [{ pattern: /^.+@byu\.edu$/i, example: 'netid@byu.edu' }];

const ALLOWED_SIGNUP_EMAIL_EXAMPLES = ALLOWED_SIGNUP_EMAIL_PATTERNS.map((p) => p.example).join(' or ');
const ALLOWED_SIGNUP_EMAIL_PATTERN_ATTR = ALLOWED_SIGNUP_EMAIL_PATTERNS.map((p) => p.pattern.source).join('|');

function emailMatchesAllowedPattern(value) {
  return ALLOWED_SIGNUP_EMAIL_PATTERNS.some(({ pattern }) => pattern.test(value));
}

// The domain suffix (e.g. "byu.edu") a pattern requires, recovered from its "^.+@<domain>$"
// source so the "still typing" check below has a plain string to compare prefixes against.
function allowedDomainSuffix(pattern) {
  return pattern.source
    .replace(/^\^\.\+@/, '')
    .replace(/\$$/, '')
    .replace(/\\(.)/g, '$1');
}

// True while the text after "@" is still a prefix of some allowed domain (including no "@" yet,
// or nothing after it) - i.e. the user could still be in the middle of typing an allowed domain.
// Used to hold off showing the domain error until they've actually typed something else.
function isTypingTowardAllowedDomain(value) {
  const atIndex = value.indexOf('@');
  if (atIndex === -1) {
    return true;
  }
  const domain = value.slice(atIndex + 1).toLowerCase();
  return ALLOWED_SIGNUP_EMAIL_PATTERNS.some(({ pattern }) => allowedDomainSuffix(pattern).startsWith(domain));
}

function Login({ courseOps }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [showSignup, setShowSignup] = useState(false);
  const { showAlert } = useAlert();
  const otpDialogRef = useRef(null);

  const trimmedEmail = email.trim();
  const emailMatchesAllowedDomain = emailMatchesAllowedPattern(trimmedEmail);
  const emailNeedsAllowedDomain = showSignup && !emailMatchesAllowedDomain && !isTypingTowardAllowedDomain(trimmedEmail);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (showSignup && !emailMatchesAllowedDomain) {
      showAlert({ message: `Please use an allowed email address to create an account (e.g. ${ALLOWED_SIGNUP_EMAIL_EXAMPLES}).`, type: 'error' });
      return;
    }
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
        placeholder: 'One-time code',
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
      const rawMessage = error?.message || '';
      const signupBlockedDuringLogin = !showSignup && rawMessage.toLowerCase().includes('signups not allowed for otp');
      const message = signupBlockedDuringLogin ? 'Login failed. Unknown email. You may need to create an account first.' : `Login failed. Please try again. ${rawMessage}`;
      showAlert({ message, type: 'error' });
    }
  };

  return (
    <div className="flex flex-col items-center justify-center relative bg-white bg-opacity-90 shadow-lg rounded-lg overflow-hidden max-w-md w-full min-h-[300px] px-8 py-2">
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
          <input id="email" type="email" className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-400" placeholder={showSignup ? ALLOWED_SIGNUP_EMAIL_PATTERNS[0].example : 'you@example.com'} autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} pattern={showSignup ? ALLOWED_SIGNUP_EMAIL_PATTERN_ATTR : undefined} title={showSignup ? `Enter an allowed email address (e.g. ${ALLOWED_SIGNUP_EMAIL_EXAMPLES})` : undefined} />
          {showSignup && <p className={`text-red-600 text-sm mt-1 ${emailNeedsAllowedDomain ? '' : 'invisible'}`}>You must use an allowed email address to create an account (e.g. {ALLOWED_SIGNUP_EMAIL_EXAMPLES}).</p>}
        </div>
        <div className="flex space-x-2">
          <button type="submit" className="flex-1 disabled:bg-gray-300 disabled:hover:bg-gray-300 bg-amber-400 hover:bg-amber-500 text-white font-semibold py-2 rounded transition" disabled={!email || (showSignup && !name) || (showSignup && !emailMatchesAllowedDomain)}>
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
