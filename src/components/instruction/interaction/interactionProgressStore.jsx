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

// Replaces the entire store contents with `nextEntries` (a Map or plain object of
// interactionId -> details), notifying subscribers for every id that either changed or
// disappeared entirely. This is used when switching which learner's progress is being
// viewed (e.g. entering/exiting observe mode): addInteractionProgress/updateInteractionProgress
// only ever ADD or OVERWRITE keys present in a fetch, so an interaction the newly-viewed
// learner never submitted would otherwise keep showing the PREVIOUS learner's stale answer
// forever, since nothing tells its still-mounted component that the data is now gone.
export const replaceAllInteractionProgress = (nextEntries) => {
  const nextMap = nextEntries instanceof Map ? nextEntries : new Map(Object.entries(nextEntries || {}));
  const affectedIds = new Set([...progressStore.keys(), ...nextMap.keys()]);
  progressStore = nextMap;
  affectedIds.forEach((id) => {
    listeners.forEach((listener) => listener(id, nextMap.get(id)));
  });
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
