import React, { createContext, useContext, useState } from 'react';

const ProgressContext = createContext();

export function ProgressProvider({ children }) {
  const [progress, setProgress] = useState(null);
  const cancelledRef = React.useRef(false);

  const showProgress = (progressData) => {
    setProgress(progressData);
  };

  const hideProgress = () => {
    setProgress(null);
  };

  const updateProgress = (updates) => {
    if (!cancelledRef.current) {
      setProgress((prev) => (prev ? { ...prev, ...updates } : null));
    }
  };

  const cancelProgress = () => {
    setProgress({ ...progress, currentItem: 'Cancelling...' });
    cancelledRef.current = true;
    if (progress?.onCancel) {
      progress.onCancel();
    }
  };

  return (
    <ProgressContext.Provider value={{ showProgress, hideProgress, updateProgress, cancelProgress }}>
      {children}
      {progress && <ProgressOverlay {...progress} onCancel={cancelProgress} />}
    </ProgressContext.Provider>
  );
}

export const useProgress = () => {
  const context = useContext(ProgressContext);
  if (!context) {
    throw new Error('useProgress must be used within ProgressProvider');
  }
  return context;
};

/**
 * ProgressOverlay displays a full-screen overlay with progress information
 *
 * Usage:
 *
 * 1. Wrap your app with the ProgressProvider:
 *    import { ProgressProvider } from './contexts/ProgressContext';
 *
 *    <ProgressProvider>
 *      <Component />
 *    </ProgressProvider>
 *
 * 2. Use the useProgress hook in your component:
 *    import { useProgress } from './contexts/ProgressContext';
 *
 *    const { showProgress, updateProgress, hideProgress, cancelProgress } = useProgress();
 *
 *    // Show progress with optional cancel callback
 *    showProgress({
 *      title: "Generating Topics",
 *      currentItem: "Introduction to React",
 *      current: 1,
 *      total: 10,
 *      onCancel: () => {
 *        // Handle cancellation logic here
 *        console.log("Operation cancelled");
 *      }
 *    });
 *
 *    // Update current item
 *    updateProgress({ currentItem: "React Components", current: 2 });
 *
 *    // Hide progress
 *    hideProgress();
 *
 *    // Cancel progress (calls onCancel if provided)
 *    cancelProgress();
 */
function ProgressOverlay({ title, currentItem, current, total, onCancel }) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-gray-900/75 flex justify-center items-center z-[9999]">
      <div className="bg-white rounded-lg shadow-2xl p-8 min-w-[400px] max-w-[500px] mx-4">
        <div className="text-center">
          {/* Title */}
          <h2 className="text-xl font-semibold text-gray-800 mb-6">{title}</h2>

          {/* Progress bar */}
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>
                {current} of {total}
              </span>
              <span>{percentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-amber-600 h-2 rounded-full transition-all duration-300 ease-out" style={{ width: `${percentage}%` }}></div>
            </div>
          </div>

          {/* Current item */}
          <div className="text-center">
            <p className="text-lg font-medium text-gray-800 break-words">{currentItem}</p>
          </div>

          {/* Loading spinner */}
          <div className="flex justify-center mt-6">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-amber-600"></div>
          </div>

          {/* Cancel button */}
          {onCancel && (
            <div className="mt-6">
              <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors duration-200">
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
