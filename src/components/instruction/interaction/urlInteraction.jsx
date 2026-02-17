import React, { useState } from 'react';
import inlineLiteMarkdown from './inlineLiteMarkdown';
import { useInteractionProgressStore, updateInteractionProgress } from './interactionProgressStore';
import InteractionFeedback from './interactionFeedback';

export default function UrlInteraction({ id, body, title, courseOps, instructionState, onGraded }) {
  const progress = useInteractionProgressStore(id) || {};
  const existingUrl = progress.url || '';
  const [currentUrl, setCurrentUrl] = useState(existingUrl);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isValidUrl = (url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async () => {
    if (!currentUrl || !isValidUrl(currentUrl)) return;

    setIsSubmitting(true);
    onGraded?.('pending');

    try {
      const feedback = 'Submission received. Thank you!';
      const details = { type: 'url-submission', url: currentUrl, feedback };

      updateInteractionProgress(id, details);
      await courseOps.addProgress(null, id, 'quizSubmit', 0, details);
      onGraded?.(100);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-3 break-words whitespace-pre-line" data-plugin-masteryls-body>
        {inlineLiteMarkdown(body)}
      </div>
      <input type="url" name={`quiz-${id}`} className="w-full p-3 border bg-white border-gray-300 rounded-lg transition-colors duration-200 placeholder-gray-400" defaultValue={existingUrl} placeholder="Enter URL here..." onChange={(e) => setCurrentUrl(e.target.value)} />
      <button onClick={handleSubmit} type="button" className="mt-3 px-6 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 transition-colors duration-200" disabled={!currentUrl || !isValidUrl(currentUrl) || isSubmitting}>
        Submit URL
      </button>
      {instructionState !== 'exam' && <InteractionFeedback quizId={id} courseOps={courseOps} instructionState={instructionState} />}
    </div>
  );
}
