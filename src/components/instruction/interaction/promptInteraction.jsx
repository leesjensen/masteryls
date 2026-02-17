import React, { useState } from 'react';
import { useInteractionProgressStore, updateInteractionProgress } from './interactionProgressStore';
import inlineLiteMarkdown from './inlineLiteMarkdown';
import InteractionFeedback from './interactionFeedback';

export default function PromptInteraction({ id, body, title, courseOps, instructionState, onGraded }) {
  const progress = useInteractionProgressStore(id) || {};
  const value = progress.prompt || '';
  const [currentValue, setCurrentValue] = useState(value);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!currentValue.trim()) return;

    setIsSubmitting(true);
    onGraded?.('pending');

    try {
      const feedback = await courseOps.getPromptResponse(currentValue);
      const details = { type: 'prompt', prompt: currentValue, feedback };

      updateInteractionProgress(id, details);
      await courseOps.addProgress(null, id, 'quizSubmit', 0, details);
      onGraded?.(-1);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-3 break-words whitespace-pre-line" data-plugin-masteryls-body>
        {inlineLiteMarkdown(body)}
      </div>
      <textarea name={`interaction-${id}`} className="w-full h-32 p-3 border bg-white border-gray-300 rounded-lg resize-y transition-colors duration-200 placeholder-gray-400" placeholder="Create your prompt here ..." defaultValue={value} onChange={(e) => setCurrentValue(e.target.value)}></textarea>
      <button onClick={handleSubmit} type="button" className="mt-3 px-6 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 transition-colors duration-200" disabled={!currentValue.trim() || isSubmitting}>
        Submit
      </button>
      {instructionState !== 'exam' && <InteractionFeedback quizId={id} courseOps={courseOps} instructionState={instructionState} />}
    </div>
  );
}
