import { useState, useEffect } from 'react';

// Global interaction progress store
let progressStore = new Map();
const listeners = new Set();

// Add interaction progress for a specific interaction
export const addInteractionProgress = (interactionId, details) => {
  progressStore.set(interactionId, details);
  listeners.forEach((listener) => listener(interactionId, details));
};

// Update interaction progress for a specific interaction
export const updateInteractionProgress = (interactionId, details) => {
  progressStore.set(interactionId, details);
  listeners.forEach((listener) => listener(interactionId, details));
};

// Get interaction progress for a specific interaction
export const getInteractionProgress = (interactionId) => {
  return progressStore.get(interactionId);
};

// Hook to subscribe to interaction progress changes for a specific interaction
export const useInteractionProgressStore = (interactionId) => {
  const [details, setDetails] = useState(() => getInteractionProgress(interactionId));

  useEffect(() => {
    const listener = (updatedInteractionId, newDetails) => {
      if (updatedInteractionId === interactionId) {
        setDetails(newDetails);
      }
    };

    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }, [interactionId]);

  return details;
};

// Hook to get completion percentage for multiple interactions
export const useTopicInteractionProgress = (interactionIds) => {
  const [percentage, setPercentage] = useState(0);

  useEffect(() => {
    if (!interactionIds || interactionIds.length === 0) {
      setPercentage(0);
      return;
    }

    const calculatePercentage = () => {
      const completedCount = interactionIds.filter((id) => {
        const progress = progressStore.get(id);
        return progress?.completed || progress?.correct;
      }).length;
      return Math.round((completedCount / interactionIds.length) * 100);
    };

    // Initial calculation
    setPercentage(calculatePercentage());

    // Listen for changes to any of these interactions
    const listener = (updatedInteractionId) => {
      if (interactionIds.includes(updatedInteractionId)) {
        setPercentage(calculatePercentage());
      }
    };

    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }, [interactionIds?.join(',')]);

  return percentage;
};
