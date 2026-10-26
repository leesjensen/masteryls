import React from 'react';
import Modal from './ui/Modal.jsx';
import Button from './ui/Button.jsx';
import Input from './ui/Input.jsx';

export default function UserProfileDialog({ user, courseOps, isOpen, onClose }) {
  const dialogRef = React.useRef(null);
  const [name, setName] = React.useState(user?.name || '');
  const [email, setEmail] = React.useState(user?.email || '');
  const [error, setError] = React.useState('');
  const [info, setInfo] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen) return;
    setName(user?.name || '');
    setEmail(user?.email || '');
    setError('');
    setInfo('');
    dialogRef.current?.showModal();
  }, [isOpen, user?.name, user?.email]);

  if (!isOpen) return null;

  function handleClose() {
    setError('');
    setInfo('');
    setSaving(false);
    dialogRef.current?.close();
    onClose?.();
  }

  async function handleSave(event) {
    event.preventDefault();
    setError('');
    setInfo('');

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      setError('Name is required.');
      return;
    }
    if (!trimmedEmail) {
      setError('Email is required.');
      return;
    }

    const nameChanged = trimmedName !== (user?.name || '');
    const emailChanged = trimmedEmail.toLowerCase() !== String(user?.email || '').toLowerCase();
    if (!nameChanged && !emailChanged) {
      handleClose();
      return;
    }

    setSaving(true);
    try {
      const result = await courseOps.updateUserProfile({
        name: nameChanged ? trimmedName : undefined,
        email: emailChanged ? trimmedEmail : undefined,
      });

      if (result?.emailConfirmationPending) {
        setInfo(`Confirmation sent to ${trimmedEmail}. Click the link in that email to finish the change. Your sign-in email will update once confirmed.`);
      } else {
        handleClose();
      }
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal dialogRef={dialogRef} onCancel={handleClose}>
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-lg font-semibold text-gray-800">Edit profile</h3>
          <button type="button" onClick={handleClose} className="text-sm text-gray-500 hover:text-gray-700">
            Close
          </button>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Name</span>
          <Input type="text" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Email</span>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <span className="text-xs text-gray-500">Changing your email sends a confirmation link to the new address.</span>
        </label>

        {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}
        {info && <div className="text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded-md px-3 py-2">{info}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
