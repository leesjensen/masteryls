import React from 'react';
import { useInteractionProgressStore } from './interactionProgressStore';
import inlineLiteMarkdown from './inlineLiteMarkdown';

export default function PromptInteraction({ id, body }) {
  const progress = useInteractionProgressStore(id) || {};
  const value = progress.prompt || '';
  const [currentValue, setCurrentValue] = React.useState(value);

  return (
    <div>
      <div className="mb-3 break-words whitespace-pre-line" data-plugin-masteryls-body>
        {inlineLiteMarkdown(body)}
      </div>
      <textarea name={`interaction-${id}`} className="w-full h-32 p-3 border bg-white border-gray-300 rounded-lg resize-y transition-colors duration-200 placeholder-gray-400" placeholder="Create your prompt here ..." defaultValue={value} onChange={(e) => setCurrentValue(e.target.value)}></textarea>
      <button id={`submit-${id}`} type="submit" className="mt-3 px-6 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 transition-colors duration-200" disabled={!currentValue.trim()}>
        Submit
      </button>
    </div>
  );
}
