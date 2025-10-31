import React from 'react';
import inlineLiteMarkdown from './inlineLiteMarkdown';
import { useQuizProgressStore } from './quizProgressStore';

export default function QuizFeedback({ quizId }) {
  const details = useQuizProgressStore(quizId);
  if (!details) {
    return null;
  }

  return (
    <div className="mt-4 p-3 border rounded bg-blue-50 text-blue-900 relative">
      {details.percentCorrect !== undefined && <div className={`absolute bottom-0 right-0 px-1 w-12 text-center bg-blue-100 text-white text-sm font-semibold rounded-br-sm`}>{details.percentCorrect}%</div>}
      <div>{inlineLiteMarkdown(details.feedback)}</div>
    </div>
  );
}
