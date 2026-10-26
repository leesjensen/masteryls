import React, { createContext, useContext, useRef, useState } from 'react';
import Modal from '../components/ui/Modal.jsx';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';

const AlertContext = createContext();

// Normalize a string-or-options argument so callers can write either
// confirm('Delete?') or confirm({ message, title, danger, ... }).
function normalizeOptions(options) {
  return typeof options === 'string' ? { message: options } : options || {};
}

export function AlertProvider({ children }) {
  const [alert, setAlert] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const [promptState, setPromptState] = useState(null);
  const confirmResolver = useRef(null);
  const promptResolver = useRef(null);

  const showAlert = (alertData) => {
    setAlert(alertData);
  };

  const hideAlert = (onClose) => {
    setAlert(null);
    if (onClose) onClose();
  };

  // Promise-based replacement for window.confirm. Resolves true/false.
  // Named showConfirm (not confirm) so consumers never shadow the window.confirm global.
  const showConfirm = (options = {}) =>
    new Promise((resolve) => {
      confirmResolver.current = resolve;
      setConfirmState(normalizeOptions(options));
    });

  const closeConfirm = (value) => {
    const resolve = confirmResolver.current;
    confirmResolver.current = null;
    setConfirmState(null);
    if (resolve) resolve(value);
  };

  // Promise-based replacement for window.prompt. Resolves the entered string, or null on cancel.
  // Named showPrompt (not prompt) so consumers never shadow the window.prompt global.
  const showPrompt = (options = {}) =>
    new Promise((resolve) => {
      promptResolver.current = resolve;
      setPromptState(normalizeOptions(options));
    });

  const closePrompt = (value) => {
    const resolve = promptResolver.current;
    promptResolver.current = null;
    setPromptState(null);
    if (resolve) resolve(value);
  };

  return (
    <AlertContext.Provider value={{ showAlert, hideAlert, showConfirm, showPrompt }}>
      {children}
      {alert && <AlertDialog message={alert.message} type={alert.type} onClose={() => hideAlert(alert.onClose)} />}
      {confirmState && <ConfirmModal state={confirmState} onResolve={closeConfirm} />}
      {promptState && <PromptModal state={promptState} onResolve={closePrompt} />}
    </AlertContext.Provider>
  );
}

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within AlertProvider');
  }
  return context;
};

/**
 * AlertDialog blocks the user from interacting with the app until they acknowledge the message.
 *
 * Usage:
 *
 * 1. Wrap your app with the AlertProvider:
 *    import { AlertProvider } from './contexts/AlertContext';
 *
 *    <AlertProvider>
 *      <App />
 *    </AlertProvider>
 *
 * 2. Use the useAlert hook in your component:
 *    import { useAlert } from './contexts/AlertContext';
 *
 *    const { showAlert, showConfirm, showPrompt } = useAlert();
 *
 *    showAlert({ message: 'This is an alert message!', type: 'error' });
 *    if (await showConfirm('Delete this item?')) { ... }
 *    const name = await showPrompt({ message: 'New name:', initialValue: current });
 *
 * Props for showAlert:
 * - message: string, the alert message to display.
 * - type: "error" | "info", controls the color/style. Defaults to info.
 * - onClose: function, called when the close button is clicked.
 *
 * showConfirm(options) / showPrompt(options) accept either a message string or an options
 * object ({ message, title, confirmButtonText, cancelButtonText, danger, placeholder,
 * initialValue }). showConfirm resolves a boolean; showPrompt resolves the string or null.
 * They are named show* (not confirm/prompt) so callers never shadow the window globals.
 */
function AlertDialog({ message, type, onClose }) {
  return (
    <div className="fixed inset-0 bg-gray-400/50 flex justify-center items-start z-[9999]" onClick={onClose}>
      <div className={`mt-16 min-w-[300px] p-4 rounded-sm shadow-2xl border-l-16 bg-white ${type === 'error' ? 'border-red-700 text-red-700' : 'bg-white border-blue-700 text-blue-700'}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <span>{message}</span>
          <button onClick={onClose} className="ml-4 text-4xl font-bold hover:opacity-70 focus:outline-none">
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ state, onResolve }) {
  const dialogRef = useRef(null);

  React.useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  return (
    <Modal dialogRef={dialogRef} title={state.title ?? 'Please confirm'} size="sm" onClose={() => onResolve(false)}>
      <div className="mb-6 text-gray-700">{state.message}</div>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={() => onResolve(false)}>
          {state.cancelButtonText ?? 'Cancel'}
        </Button>
        <Button variant={state.danger ? 'danger' : 'primary'} onClick={() => onResolve(true)}>
          {state.confirmButtonText ?? 'OK'}
        </Button>
      </div>
    </Modal>
  );
}

function PromptModal({ state, onResolve }) {
  const dialogRef = useRef(null);
  const [value, setValue] = useState(state.initialValue ?? '');

  React.useEffect(() => {
    dialogRef.current?.showModal();
    setTimeout(() => {
      dialogRef.current?.querySelector('input')?.focus();
    }, 0);
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (value.trim()) onResolve(value);
    }
  };

  return (
    <Modal dialogRef={dialogRef} title={state.title ?? 'Enter a value'} size="sm" onClose={() => onResolve(null)}>
      {state.message && <div className="mb-4 text-gray-700">{state.message}</div>}
      <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={state.placeholder} className="mb-4" onKeyDown={handleKeyDown} />
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={() => onResolve(null)}>
          {state.cancelButtonText ?? 'Cancel'}
        </Button>
        <Button onClick={() => onResolve(value)} disabled={!value.trim()}>
          {state.confirmButtonText ?? 'OK'}
        </Button>
      </div>
    </Modal>
  );
}
