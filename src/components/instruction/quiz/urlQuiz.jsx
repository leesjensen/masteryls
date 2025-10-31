import React from 'react';
import { useQuizFeedback } from './feedbackStore';

export default function UrlQuiz({ quizId }) {
  const progress = useQuizFeedback(quizId) || {};
  const existingUrl = progress.url || '';

  return (
    <div>
      <input type="url" name={`quiz-${quizId}`} className="w-full p-3 border bg-white border-gray-300 rounded-lg transition-colors duration-200 placeholder-gray-400" defaultValue={existingUrl} placeholder="Enter URL here..." />
      <button type="submit" className="mt-3 px-6 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200">
        Submit URL
      </button>
    </div>
  );
}
