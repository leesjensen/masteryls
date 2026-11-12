import React from 'react';
import Modal from '../components/ui/Modal.jsx';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import Textarea from '../components/ui/Textarea.jsx';

export default function InputDialog({ dialogRef, title: defaultTitle, description: defaultDescription, placeholder: defaultPlaceholder, confirmButtonText: defaultConfirmButtonText = 'OK', cancelButtonText: defaultCancelButtonText = 'Cancel' }) {
  const [inputValue, setInputValue] = React.useState('');
  const [choice, setChoice] = React.useState('');
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
  // Optional radio group: { label?, options: [{ value, label, description? }], defaultValue? }.
  // When present, the dialog resolves with { value, choice } instead of a bare string.
  const currentChoices = dynamicContent.choices ?? null;

  const closeDialog = (value) => {
    dialogRef.current.close();
    setInputValue('');

    if (dialogRef.current._resolve) {
      const resolved = value !== null && currentChoices ? { value, choice } : value;
      dialogRef.current._resolve(resolved);
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
          setChoice(options.choices?.defaultValue ?? options.choices?.options?.[0]?.value ?? '');
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

      {currentChoices && (
        <fieldset className="mb-4">
          {currentChoices.label && <legend className="mb-1 text-sm font-medium text-gray-700">{currentChoices.label}</legend>}
          <div className="flex flex-wrap gap-4">
            {currentChoices.options.map((option) => (
              <label key={option.value} className="flex cursor-pointer items-start gap-2 text-sm text-gray-700">
                <input type="radio" name="input-dialog-choice" value={option.value} checked={choice === option.value} onChange={() => setChoice(option.value)} className="mt-0.5 accent-blue-600" />
                <span>
                  <span className="font-medium">{option.label}</span>
                  {option.description && <span className="block text-xs text-gray-500">{option.description}</span>}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
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
