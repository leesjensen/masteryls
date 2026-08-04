import React from 'react';
import { useInteractionProgressStore } from './interactionProgressStore';
import { renderLiteMarkdownBlocks } from './inlineLiteMarkdown';
import { InteractionSubmitRow } from './InteractionEvaluationStatus.jsx';

export default function EssayInteraction({ id, body }) {
  const progress = useInteractionProgressStore(id) || {};
  const value = progress.essay || '';
  const [currentValue, setCurrentValue] = React.useState(value);

  // The saved essay can arrive after mount (the progress store is populated async when a topic
  // loads). Re-sync so a previously-submitted answer renders even when it lands late; only runs
  // when the saved text changes, so it never clobbers in-progress typing (the store holds an
  // essay only after submit).
  React.useEffect(() => {
    setCurrentValue(progress.essay || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress.essay]);

  return (
    <div>
      <div className="mb-3 break-words whitespace-pre-line" data-plugin-masteryls-body>
        {renderLiteMarkdownBlocks(body)}
      </div>

      <textarea name={`interaction-${id}`} className="w-full h-32 p-3 border bg-white border-gray-300 rounded-lg resize-y transition-colors duration-200 placeholder-gray-400" placeholder="Enter your answer here..." value={currentValue} onChange={(e) => setCurrentValue(e.target.value)}></textarea>
      <InteractionSubmitRow id={id} details={progress} disabled={!currentValue.trim()} />
    </div>
  );
}
