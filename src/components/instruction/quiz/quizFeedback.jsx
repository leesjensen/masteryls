import React from 'react';
import inlineLiteMarkdown from './inlineLiteMarkdown';
import { useQuizFeedback } from './feedbackStore';

export default function QuizFeedback({ quizId }) {
  const feedback = useQuizFeedback(quizId);
  if (!feedback) {
    return null;
  }

  return (
    <div className="mt-4 p-3 border rounded bg-blue-50 text-blue-900 relative">
      {feedback.percentCorrect !== undefined && <div className="absolute top-0 right-0 px-3 py-1 bg-blue-100 text-white text-sm font-semibold rounded-tr-sm">{feedback.percentCorrect}%</div>}
      <div>{inlineLiteMarkdown(feedback.text)}</div>
    </div>
  );
}
