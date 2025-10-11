import { useEffect, useRef } from 'react';

/**
 * Custom hook for tracking user interaction time with content
 *
 * @example
 * // Basic usage - automatically track viewing time
 * useProgressTracking({
 *   activityId: 'uuid',
 *   activityType: 'instructionView',
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
 *   activityId: 'uuid',
 *   activityType: 'videoView',
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
 * @param {string} options.activityId - Unique identifier for the activity being tracked
 * @param {string} options.activityType - Type of activity (e.g., 'instructionView', 'videoView', 'quizAttempt')
 * @param {Function} options.onProgress - Function to call when recording progress (activityId, type, duration) => void
 * @param {boolean} options.enabled - Whether tracking is enabled (default: true)
 * @param {number} options.minDuration - Minimum duration in seconds before recording (default: 1)
 * @param {Array} options.dependencies - Additional dependencies to restart tracking (default: [])
 * @returns {Object} - Object with current session info and manual control functions
 */
export default function useProgressTracking({ activityId, activityType, onProgress, enabled = true, minDuration = 30, dependencies = [] }) {
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
    if (!enabled || !activityId || !onProgress || !isTrackingRef.current) {
      return false;
    }

    const duration = getCurrentDuration();
    if (duration >= minDuration) {
      try {
        await onProgress(activityId, activityType, duration);
        return true;
      } catch (error) {
        console.warn(`Failed to record progress for ${activityType}:`, error);
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
    if (startTimeRef.current && isVisibleRef.current) {
      totalTimeRef.current += Date.now() - startTimeRef.current;
    }
    isTrackingRef.current = false;
  };

  // Function to resume tracking
  const resumeTracking = () => {
    if (!isTrackingRef.current) {
      startTimeRef.current = Date.now();
      isVisibleRef.current = !document.hidden;
      isTrackingRef.current = true;
    }
  };

  useEffect(() => {
    if (!enabled || !activityId || !onProgress) {
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
    return async () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      await recordProgress();
      isTrackingRef.current = false;
    };
  }, [activityId, activityType, enabled, ...dependencies]);

  return {
    getCurrentDuration,
    recordProgress,
    resetTracking,
    pauseTracking,
    resumeTracking,
    isTracking: isTrackingRef.current,
  };
}
