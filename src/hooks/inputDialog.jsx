import React from 'react';

export default function InputDialog({ dialogRef, title: defaultTitle, description: defaultDescription, placeholder: defaultPlaceholder, confirmButtonText: defaultConfirmButtonText = 'OK', cancelButtonText: defaultCancelButtonText = 'Cancel' }) {
  const [inputValue, setInputValue] = React.useState('');
  // State for dynamic content that can be overridden by show() method
  const [dynamicContent, setDynamicContent] = React.useState({});

  // Merge default props with dynamic content
  const currentTitle = dynamicContent.title ?? defaultTitle;
  const currentDescription = dynamicContent.description ?? defaultDescription;
  const currentPlaceholder = dynamicContent.placeholder ?? defaultPlaceholder;
  const currentConfirmButtonText = dynamicContent.confirmButtonText ?? defaultConfirmButtonText;
  const currentCancelButtonText = dynamicContent.cancelButtonText ?? defaultCancelButtonText;

  const closeDialog = (value) => {
    dialogRef.current.close();
    setInputValue('');

    if (dialogRef.current._resolve) {
      dialogRef.current._resolve(value);
      dialogRef.current._resolve = null;
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      e.preventDefault();
      closeDialog(e.key === 'Enter' ? inputValue : null);
    }
  };

  // Add show method to the dialog ref for promise-based usage
  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog) {
      // Add a show method that returns a promise and accepts options
      dialog.show = (options = {}) => {
        return new Promise((resolve) => {
          dialog._resolve = resolve;
          setDynamicContent(options);
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
    <dialog ref={dialogRef} className="w-full p-6 rounded-lg shadow-lg max-w-md mt-20 mx-auto" onClick={(e) => e.stopPropagation()}>
      {currentTitle && <h2 className="text-xl font-bold text-amber-500 mb-4">{currentTitle}</h2>}
      {currentDescription && <div className="mb-4 text-gray-700">{currentDescription}</div>}

      <input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder={currentPlaceholder} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent mb-4" onKeyDown={handleKeyDown} />

      <div className="flex justify-end gap-3">
        <button onClick={() => closeDialog(null)} className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors">
          {currentCancelButtonText}
        </button>
        <button onClick={() => closeDialog(inputValue)} disabled={!inputValue.trim()} className="px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors">
          {currentConfirmButtonText}
        </button>
      </div>
    </dialog>
  );
}
