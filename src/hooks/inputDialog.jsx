import React from 'react';

export default function InputDialog({ dialogRef, title, description, placeholder, confirmButtonText = 'OK', cancelButtonText = 'Cancel', inputType = 'text', required = false }) {
  const [inputValue, setInputValue] = React.useState('');

  const closeDialog = () => {
    dialogRef.current.close();
    setInputValue('');
    // Resolve with null if there's a pending promise (user cancelled)
    if (dialogRef.current._resolve) {
      dialogRef.current._resolve(null);
      dialogRef.current._resolve = null;
    }
  };

  const handleConfirm = () => {
    const value = inputValue.trim();
    if (required && !value) return;

    // Resolve with the value if there's a pending promise
    if (dialogRef.current._resolve) {
      dialogRef.current._resolve(value);
      dialogRef.current._resolve = null;
    }

    dialogRef.current.close();
    setInputValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      closeDialog();
    }
  };

  // Add show method to the dialog ref for promise-based usage
  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog) {
      // Add a show method that returns a promise
      dialog.show = () => {
        return new Promise((resolve) => {
          dialog._resolve = resolve;
          setInputValue('');
          dialog.showModal();
        });
      };

      const handleOpen = () => {
        setInputValue('');
        // Focus the input after the dialog opens
        setTimeout(() => {
          const input = dialog.querySelector('input');
          if (input) input.focus();
        }, 0);
      };

      dialog.addEventListener('open', handleOpen);
      return () => {
        dialog.removeEventListener('open', handleOpen);
        // Clean up the custom show method
        delete dialog.show;
        delete dialog._resolve;
      };
    }
  }, [dialogRef]);

  return (
    <dialog ref={dialogRef} className="p-6 rounded-lg shadow-lg max-w-md mt-20 mx-auto" onClick={(e) => e.stopPropagation()}>
      {title && <h2 className="text-xl font-bold text-amber-500 mb-4">{title}</h2>}
      {description && <div className="mb-4 text-gray-700">{description}</div>}

      <input type={inputType} value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder={placeholder} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent mb-4" onKeyDown={handleKeyDown} />

      <div className="flex justify-end gap-3">
        <button onClick={closeDialog} className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors">
          {cancelButtonText}
        </button>
        <button onClick={handleConfirm} disabled={required && !inputValue.trim()} className="px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors">
          {confirmButtonText}
        </button>
      </div>
    </dialog>
  );
}
