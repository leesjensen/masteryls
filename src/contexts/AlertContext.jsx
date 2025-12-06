import React, { createContext, useContext, useState } from 'react';

const AlertContext = createContext();

export function AlertProvider({ children }) {
  const [alert, setAlert] = useState(null);

  const showAlert = (alertData) => {
    setAlert(alertData);
  };

  const hideAlert = (onClose) => {
    setAlert(null);
    if (onClose) onClose();
  };

  return (
    <AlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}
      {alert && <AlertDialog message={alert.message} type={alert.type} onClose={() => hideAlert(alert.onClose)} />}
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
 *    const { showAlert } = useAlert();
 *
 *    <button onClick={() => showAlert({ message: "This is an alert message!", type: "error" })}>
 *      Show Alert
 *    </button>
 *
 * The alert dialog will automatically appear when showAlert is called.
 *
 * Props for showAlert:
 * - message: string, the alert message to display.
 * - type: "error" | "info", controls the color/style. Defaults to info.
 * - onClose: function, called when the close button is clicked.
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
