import React from 'react';

/**
 * AlertDialog blocks the user from interacting with the app until they acknowledge the message.
 *
 * Usage:
 *
 * 1. Import the AlertDialog component:
 *    import AlertDialog from './hooks/alertDialog';
 *
 * 2. Use it in your component:
 *
 *    const [alert, setAlert] = React.useState(null);
 *
 *    <button onClick={() => setAlert({ message: "This is an alert message!", type: "error" })}>Show Alert</button>
 *    {alert && (
 *      <AlertDialog
 *        message={alert.message}
 *        type={alert.type}
 *        onClose={() => setAlert(null)}
 *      />
 *    )}
 *
 * Props:
 * - message: string, the alert message to display.
 * - type: "error" | "info", controls the color/style.
 * - onClose: function, called when the close button is clicked.
 */
export default function AlertDialog({ message, type, onClose }) {
  return (
    <div className="fixed inset-0 bg-gray-400/50 flex justify-center items-start z-50">
      <div className={`mt-16 min-w-[300px] p-4 rounded-sm shadow-2xl border-l-16 bg-white ${type === 'error' ? 'border-red-700 text-red-700' : 'bg-white border-blue-700 text-blue-700'}`}>
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
