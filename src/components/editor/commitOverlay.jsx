import React from 'react';

export default function CommitOverlay({ message = 'Committing changes...' }) {
  return (
    <div className="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center z-50 rounded">
      <div className="flex items-center gap-3 text-gray-700">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-blue-600"></div>
        <span className="text-sm font-medium">{message}</span>
      </div>
    </div>
  );
}
