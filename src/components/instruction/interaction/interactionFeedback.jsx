import React from 'react';
import inlineLiteMarkdown from './inlineLiteMarkdown';
import { useInteractionProgressStore } from './interactionProgressStore';
import ScoreStars from './scoreStars';

export default function InteractionFeedback({ quizId }) {
  const details = useInteractionProgressStore(quizId);
  if (!details || !details.feedback) {
    return null;
  }

  return (
    <div className="mt-4 p-3 border rounded bg-blue-50 text-blue-900 relative">
      {details.percentCorrect !== undefined && (
        <div className="absolute bottom-1 right-2 ">
          <ScoreStars percent={details.percentCorrect} />
        </div>
      )}
      <div>{inlineLiteMarkdown(details.feedback)}</div>
    </div>
  );
}
