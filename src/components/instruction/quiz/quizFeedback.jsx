import React from 'react';
import inlineLiteMarkdown from './inlineLiteMarkdown';
import { useQuizFeedback } from './feedbackStore';

export default function QuizFeedback({ quizId }) {
  const feedback = useQuizFeedback(quizId);
  if (!feedback) {
    return null;
  }

  return <div className="mt-4 p-3 border rounded bg-blue-50 text-blue-900">{inlineLiteMarkdown(feedback)}</div>;
}
