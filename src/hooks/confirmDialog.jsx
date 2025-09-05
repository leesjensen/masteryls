import React from 'react';

export default function ConfirmDialog({ dialogRef, confirmed, title, message, confirmButtonText }) {
  const closeDialog = () => {
    dialogRef.current.close();
  };

  return (
    <dialog ref={dialogRef} className="p-6 rounded-lg shadow-lg max-w-md mt-20 mx-auto" onClick={(e) => e.stopPropagation()}>
      {title && <h2 className="text-xl font-bold text-amber-500 mb-4">{title}</h2>}
      <div className="mb-6 text-gray-700">{message}</div>
      <div className="flex justify-end gap-3">
        <button onClick={closeDialog} className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors">
          Cancel
        </button>
        {confirmed && (
          <button onClick={confirmed} className="px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 transition-colors">
            {confirmButtonText || 'OK'}
          </button>
        )}
      </div>
    </dialog>
  );
}
