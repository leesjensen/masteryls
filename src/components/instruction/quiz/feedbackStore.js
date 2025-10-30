import { useState, useEffect } from 'react';

// Global feedback store
let feedbackStore = new Map();
const listeners = new Set();

// Update feedback for a specific quiz
export const updateQuizFeedback = (quizId, feedback) => {
  feedbackStore.set(quizId, feedback);
  listeners.forEach((listener) => listener(quizId, feedback));
};

// Get feedback for a specific quiz
export const getQuizFeedback = (quizId) => {
  return feedbackStore.get(quizId);
};

// Hook to subscribe to feedback changes for a specific quiz
export const useQuizFeedback = (quizId) => {
  const [feedback, setFeedback] = useState(() => getQuizFeedback(quizId));

  useEffect(() => {
    const listener = (updatedQuizId, newFeedback) => {
      if (updatedQuizId === quizId) {
        setFeedback(newFeedback);
      }
    };

    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }, [quizId]);

  return feedback;
};
