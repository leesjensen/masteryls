import React from 'react';
import Modal from '../components/ui/Modal.jsx';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import Textarea from '../components/ui/Textarea.jsx';

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
  const currentMultiline = Boolean(dynamicContent.multiline);
  const currentRows = dynamicContent.rows ?? 6;

  const closeDialog = (value) => {
    dialogRef.current.close();
    setInputValue('');

    if (dialogRef.current._resolve) {
      dialogRef.current._resolve(value);
      dialogRef.current._resolve = null;
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape' || (e.key === 'Enter' && (!currentMultiline || e.metaKey || e.ctrlKey))) {
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
          setInputValue(options.initialValue ?? '');
          dialog.showModal();
          setTimeout(() => {
            const input = dialog.querySelector(options.multiline ? 'textarea' : 'input');
            if (input) input.focus();
          }, 0);
        });
      };

      const handleOpen = () => {
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
    <Modal dialogRef={dialogRef} title={currentTitle}>
      {currentDescription && <div className="mb-4 text-gray-700">{currentDescription}</div>}

      {currentMultiline ? (
        <Textarea value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder={currentPlaceholder} rows={currentRows} className="mb-4" onKeyDown={handleKeyDown} />
      ) : (
        <Input value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder={currentPlaceholder} className="mb-4" onKeyDown={handleKeyDown} />
      )}

      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={() => closeDialog(null)}>
          {currentCancelButtonText}
        </Button>
        <Button onClick={() => closeDialog(inputValue)} disabled={!inputValue.trim()}>
          {currentConfirmButtonText}
        </Button>
      </div>
    </Modal>
  );
}
