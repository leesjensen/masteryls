import React from 'react';
import { useInteractionProgressStore } from './interactionProgressStore';
import { renderLiteMarkdownBlocks } from './inlineLiteMarkdown';
import { InteractionSubmitRow } from './InteractionEvaluationStatus.jsx';

export default function PromptInteraction({ id, body }) {
  const progress = useInteractionProgressStore(id) || {};
  const value = progress.prompt || '';
  const [currentValue, setCurrentValue] = React.useState(value);

  return (
    <div>
      <div className="mb-3 break-words whitespace-pre-line" data-plugin-masteryls-body>
        {renderLiteMarkdownBlocks(body)}
      </div>
      <textarea name={`interaction-${id}`} className="w-full h-32 p-3 border bg-white border-gray-300 rounded-lg resize-y transition-colors duration-200 placeholder-gray-400" placeholder="Create your prompt here ..." defaultValue={value} onChange={(e) => setCurrentValue(e.target.value)}></textarea>
      <InteractionSubmitRow id={id} details={progress} disabled={!currentValue.trim()} />
    </div>
  );
}
