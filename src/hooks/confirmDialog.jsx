import React from 'react';

export default function ConfirmDialog({ dialogRef, confirmDelete }) {
  const closeDialog = () => {
    dialogRef.current.close();
  };

  return (
    <dialog ref={dialogRef} className="p-6 rounded-lg shadow-lg backdrop:bg-black backdrop:bg-opacity-50 max-w-md">
      <h2 className="text-xl font-bold text-red-600 mb-4">Delete Course Confirmation</h2>
      <p className="mb-6 text-gray-700">Because you are the owner of this course, this action will delete the course and all enrollments. If you do not want to delete the course then change the owner before you delete your enrollment. Are you sure you want to delete the course and all enrollments?</p>
      <div className="flex justify-end gap-3">
        <button onClick={closeDialog} className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors">
          Cancel
        </button>
        <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors">
          Yes, Delete Course
        </button>
      </div>
    </dialog>
  );
}
