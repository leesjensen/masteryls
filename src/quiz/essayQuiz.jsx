import React from 'react';

export default function EssayQuiz({ meta }) {
  return <textarea name={`quiz-${meta.id}`} class="w-full h-32 p-3 border border-gray-300 rounded-lg resize-none transition-colors duration-200 placeholder-gray-400" placeholder="Enter your answer here..."></textarea>;
}
