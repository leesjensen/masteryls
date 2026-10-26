import React from 'react';
import Modal from '../components/ui/Modal.jsx';
import Button from '../components/ui/Button.jsx';

export default function ConfirmDialog({ dialogRef, confirmed, title, message, confirmButtonText, danger = false }) {
  const closeDialog = () => {
    dialogRef.current.close();
  };

  return (
    <Modal dialogRef={dialogRef} title={title}>
      <div className="mb-6 text-gray-700">{message}</div>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={closeDialog}>
          Cancel
        </Button>
        {confirmed && (
          <Button variant={danger ? 'danger' : 'primary'} onClick={confirmed}>
            {confirmButtonText || 'OK'}
          </Button>
        )}
      </div>
    </Modal>
  );
}
