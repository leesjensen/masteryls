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
