import React from 'react';

export default function UrlQuiz({ meta, exam = false }) {
  return (
    <div>
      <input type="url" name={`quiz-${meta.id}`} className="w-full p-3 border bg-white border-gray-300 rounded-lg transition-colors duration-200 placeholder-gray-400" placeholder="Enter URL here..." />
      {!exam && (
        <button type="submit" className="mt-3 px-6 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200">
          Submit
        </button>
      )}
    </div>
  );
}
