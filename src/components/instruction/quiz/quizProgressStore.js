import { useState, useEffect } from 'react';

// Global quiz progress store
let progressStore = new Map();
const listeners = new Set();

// Add quiz progress for a specific quiz
export const addQuizProgress = (quizId, details) => {
  progressStore.set(quizId, details);
  listeners.forEach((listener) => listener(quizId, details));
};

// Update quiz progress for a specific quiz
export const updateQuizProgress = (quizId, details) => {
  progressStore.set(quizId, details);
  listeners.forEach((listener) => listener(quizId, details));
};

// Get quiz progress for a specific quiz
export const getQuizProgress = (quizId) => {
  return progressStore.get(quizId);
};

// Hook to subscribe to quiz progress changes for a specific quiz
export const useQuizProgressStore = (quizId) => {
  const [details, setDetails] = useState(() => getQuizProgress(quizId));

  useEffect(() => {
    const listener = (updatedQuizId, newDetails) => {
      if (updatedQuizId === quizId) {
        setDetails(newDetails);
      }
    };

    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }, [quizId]);

  return details;
};
