import React from 'react';
import { useInteractionProgressStore } from './interactionProgressStore';

export default function PromptInteraction({ interactionId }) {
  const progress = useInteractionProgressStore(interactionId) || {};
  const value = progress.prompt || '';
  return (
    <div>
      <textarea name={`interaction-${interactionId.id}`} className="w-full h-32 p-3 border bg-white border-gray-300 rounded-lg resize-y transition-colors duration-200 placeholder-gray-400" placeholder="Create your prompt here ..." defaultValue={value}></textarea>
      <button type="submit" className="mt-3 px-6 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200">
        Submit
      </button>
    </div>
  );
}
