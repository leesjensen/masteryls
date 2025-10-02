import { useState, useEffect } from 'react';

// Global feedback store
let feedbackStore = {};
const listeners = new Set();

// Notify all listeners when feedback changes
const notifyListeners = (quizId) => {
  listeners.forEach((listener) => listener(quizId));
};

// Update feedback for a specific quiz
export const updateQuizFeedback = (quizId, feedback) => {
  feedbackStore = { ...feedbackStore, [quizId]: feedback };
  notifyListeners(quizId);
};

// Get feedback for a specific quiz
export const getQuizFeedback = (quizId) => {
  return feedbackStore[quizId];
};

// Hook to subscribe to feedback changes for a specific quiz
export const useQuizFeedback = (quizId) => {
  const [feedback, setFeedback] = useState(() => getQuizFeedback(quizId));

  useEffect(() => {
    const listener = (updatedQuizId) => {
      if (updatedQuizId === quizId) {
        const newFeedback = getQuizFeedback(quizId);
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
