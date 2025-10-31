import { useState, useEffect } from 'react';

// Global feedback store
let feedbackStore = new Map();
const listeners = new Set();

// Update feedback for a specific quiz
export const updateQuizFeedback = (quizId, details) => {
  feedbackStore.set(quizId, details);
  listeners.forEach((listener) => listener(quizId, details));
};

// Get feedback for a specific quiz
export const getQuizFeedback = (quizId) => {
  return feedbackStore.get(quizId);
};

// Hook to subscribe to feedback changes for a specific quiz
export const useQuizFeedback = (quizId) => {
  const [details, setDetails] = useState(() => getQuizFeedback(quizId));

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
