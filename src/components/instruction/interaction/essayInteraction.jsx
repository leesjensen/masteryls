import React, { useState, useRef } from 'react';
import { useInteractionProgressStore, updateInteractionProgress } from './interactionProgressStore';
import { getPrecedingContent } from '../../../utils/utils';
import inlineLiteMarkdown from './inlineLiteMarkdown';
import InteractionFeedback from './interactionFeedback';

export default function EssayInteraction({ id, body, title, courseOps, instructionState, onGraded }) {
  const progress = useInteractionProgressStore(id) || {};
  const value = progress.essay || '';
  const [currentValue, setCurrentValue] = useState(value);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const containerRef = useRef(null);

  const handleSubmit = async () => {
    if (!currentValue.trim()) return;

    setIsSubmitting(true);
    onGraded?.('pending');

    try {
      const precedingContent = containerRef.current ? getPrecedingContent(containerRef.current) : '';

      const data = {
        title,
        type: 'essay',
        question: body,
        'question context': precedingContent,
        essay: currentValue,
      };

      const { feedback, percentCorrect } = await courseOps.getEssayInteractionFeedback(data);
      const details = { type: 'essay', essay: currentValue, percentCorrect, feedback };
      updateInteractionProgress(id, details);
      await courseOps.addProgress(null, id, 'quizSubmit', 0, details);
      onGraded?.(percentCorrect);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div ref={containerRef}>
      <div className="mb-3 break-words whitespace-pre-line" data-plugin-masteryls-body>
        {inlineLiteMarkdown(body)}
      </div>

      <textarea name={`interaction-${id}`} className="w-full h-32 p-3 border bg-white border-gray-300 rounded-lg resize-y transition-colors duration-200 placeholder-gray-400" placeholder="Enter your answer here..." defaultValue={value} onChange={(e) => setCurrentValue(e.target.value)}></textarea>
      <button onClick={handleSubmit} type="button" className="mt-3 px-6 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 transition-colors duration-200" disabled={!currentValue.trim() || isSubmitting}>
        Submit
      </button>
      {instructionState !== 'exam' && <InteractionFeedback quizId={id} courseOps={courseOps} instructionState={instructionState} />}
    </div>
  );
}
