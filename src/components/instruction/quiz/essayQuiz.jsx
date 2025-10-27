import React from 'react';

export default function EssayQuiz({ meta, exam = false }) {
  return (
    <div>
      <textarea name={`quiz-${meta.id}`} className="w-full h-32 p-3 border bg-white border-gray-300 rounded-lg resize-none transition-colors duration-200 placeholder-gray-400" placeholder="Enter your answer here..."></textarea>
      {!exam && (
        <button type="submit" className="mt-3 px-6 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200">
          Submit
        </button>
      )}
    </div>
  );
}
