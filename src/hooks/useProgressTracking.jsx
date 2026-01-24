import { useEffect, useRef } from 'react';

/**
 * Custom hook for tracking user interaction time with content
 *
 * @example
 * // Basic usage - automatically track viewing time
 * useProgressTracking({
 *   progressType: 'instructionView',
 *   onProgress: (id, type, duration) => courseOps.addProgress(id, type, duration),
 *   enabled: true,
 *   minDuration: 30
 * });
 *
 * @example
 * // Advanced usage with manual control
 * const {
 *   getCurrentDuration,
 *   recordProgress,
 *   pauseTracking,
 *   resumeTracking
 * } = useProgressTracking({
 *   progressType: 'videoView',
 *   onProgress: recordVideoProgress,
 *   minDuration: 10
 * });
 *
 * // Manually pause when video pauses
 * const handleVideoPause = () => {
 *   pauseTracking();
 *   recordProgress(); // Optionally record current progress
 * };
 *
 * const handleVideoPlay = () => {
 *   resumeTracking();
 * };
 *
 * @param {Object} options - Configuration options
 * @param {string} options.progressType - Type of progress being tracked (e.g., 'instructionView', 'videoView', 'quizAttempt', 'exam')
 * @param {Function} options.onProgress - Function to call when recording progress (interactionId, type, duration) => void
 * @param {boolean} options.enabled - Whether tracking is enabled (default: true)
 * @param {number} options.minDuration - Minimum duration in seconds before recording (default: 1)
 * @param {Array} options.dependencies - Additional dependencies to restart tracking (default: [])
 * @returns {Object} - Object with current session info and manual control functions
 */
export default function useProgressTracking({ progressType, onProgress, enabled = true, minDuration = 30 }) {
  const startTimeRef = useRef(null);
  const totalTimeRef = useRef(0);
  const isVisibleRef = useRef(true);
  const isTrackingRef = useRef(enabled);

  // Function to get current session duration
  const getCurrentDuration = () => {
    let totalDuration = totalTimeRef.current;
    if (startTimeRef.current && isVisibleRef.current) {
      totalDuration += Date.now() - startTimeRef.current;
    }
    return Math.round(totalDuration / 1000);
  };

  // Function to manually record progress (useful for immediate recording)
  const recordProgress = async () => {
    if (!enabled || !onProgress || !isTrackingRef.current) {
      return false;
    }

    // Accumulate any current session time before recording
    if (startTimeRef.current && isVisibleRef.current) {
      totalTimeRef.current += Date.now() - startTimeRef.current;
      startTimeRef.current = Date.now(); // Reset start time for continued tracking
    }

    const duration = getCurrentDuration();
    if (duration >= minDuration) {
      try {
        await onProgress(null, null, progressType, duration);
        // Reset total time after successful recording
        totalTimeRef.current = 0;
        return true;
      } catch (error) {
        console.warn(`Failed to record progress for ${progressType}:`, error);
        return false;
      }
    }
    return false;
  };

  // Function to reset tracking
  const resetTracking = () => {
    startTimeRef.current = Date.now();
    totalTimeRef.current = 0;
    isVisibleRef.current = !document.hidden;
    isTrackingRef.current = true;
  };

  // Function to pause tracking
  const pauseTracking = () => {
    if (startTimeRef.current && isVisibleRef.current && isTrackingRef.current) {
      totalTimeRef.current += Date.now() - startTimeRef.current;
    }
    isTrackingRef.current = false;
  };

  // Function to resume tracking
  const resumeTracking = () => {
    if (!isTrackingRef.current && enabled) {
      startTimeRef.current = Date.now();
      isVisibleRef.current = !document.hidden;
      isTrackingRef.current = true;
    }
  };

  useEffect(() => {
    if (!enabled || !onProgress) {
      return;
    }

    // Initialize tracking
    resetTracking();

    // Handle page visibility changes
    const handleVisibilityChange = () => {
      if (!isTrackingRef.current) return;

      const now = Date.now();
      if (document.hidden) {
        // Page became hidden, accumulate time
        if (startTimeRef.current && isVisibleRef.current) {
          totalTimeRef.current += now - startTimeRef.current;
        }
        isVisibleRef.current = false;
      } else {
        // Page became visible, restart timer
        startTimeRef.current = now;
        isVisibleRef.current = true;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup function to record progress when effect cleans up
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      // Pause tracking and accumulate any remaining time
      if (startTimeRef.current && isVisibleRef.current && isTrackingRef.current) {
        totalTimeRef.current += Date.now() - startTimeRef.current;
      }

      // Record progress synchronously to avoid timing issues
      const duration = Math.round(totalTimeRef.current / 1000);
      if (duration >= minDuration && isTrackingRef.current) {
        // Use setTimeout to avoid blocking the cleanup
        setTimeout(() => {
          onProgress(null, null, progressType, duration).catch((error) => {
            console.warn(`Failed to record progress for ${progressType}:`, error);
          });
        }, 0);
      }

      isTrackingRef.current = false;
    };
  }, [progressType, enabled, onProgress, minDuration]);

  return {
    getCurrentDuration,
    recordProgress,
    resetTracking,
    pauseTracking,
    resumeTracking,
    isTracking: isTrackingRef.current,
  };
}
