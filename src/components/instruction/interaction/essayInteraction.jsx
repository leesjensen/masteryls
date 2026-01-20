import React from 'react';
import { useInteractionProgressStore } from './interactionProgressStore';
import inlineLiteMarkdown from './inlineLiteMarkdown';

export default function EssayInteraction({ id, body }) {
  const progress = useInteractionProgressStore(id) || {};
  const value = progress.essay || '';
  return (
    <div>
      <div className="mb-3 break-words whitespace-pre-line" data-plugin-masteryls-body>
        {inlineLiteMarkdown(body)}
      </div>

      <textarea name={`quiz-${id}`} className="w-full h-32 p-3 border bg-white border-gray-300 rounded-lg resize-y transition-colors duration-200 placeholder-gray-400" placeholder="Enter your answer here..." defaultValue={value}></textarea>
      <button type="submit" className="mt-3 px-6 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 transition-colors duration-200">
        Submit
      </button>
    </div>
  );
}
