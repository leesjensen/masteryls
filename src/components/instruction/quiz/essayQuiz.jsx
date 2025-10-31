import React from 'react';

export default function EssayQuiz({ quizId, progress = {} }) {
  const value = progress?.details?.essay || '';
  return (
    <div>
      <textarea name={`quiz-${quizId.id}`} className="w-full h-32 p-3 border bg-white border-gray-300 rounded-lg resize-y transition-colors duration-200 placeholder-gray-400" placeholder="Enter your answer here..." defaultValue={value}></textarea>
      <button type="submit" className="mt-3 px-6 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200">
        Submit essay
      </button>
    </div>
  );
}
