import React from 'react';
import inlineLiteMarkdown from './inlineLiteMarkdown';
import { useInteractionProgressStore } from './interactionProgressStore';
import ScoreStars from './scoreStars';

export default function InteractionFeedback({ quizId, onSyncGrade = null }) {
  const details = useInteractionProgressStore(quizId);
  if (!details || !details.feedback) {
    return null;
  }

  const percentCorrect = Number(details?.percentCorrect);
  const canSyncGrade = details?.syncGrade === true && Number.isFinite(percentCorrect) && typeof onSyncGrade === 'function';
  const syncState = details?.canvasSyncState || 'idle';
  const syncMessage = details?.canvasSyncMessage || null;

  return (
    <div className="mt-4 p-3 border rounded bg-blue-50 text-blue-900 relative">
      {details.percentCorrect !== undefined && (
        <div className="absolute bottom-1 right-2 ">
          <ScoreStars percent={details.percentCorrect} />
        </div>
      )}
      <div>{inlineLiteMarkdown(details.feedback)}</div>
      {canSyncGrade && (
        <div className="mt-3">
          <button type="button" className="px-3 py-1.5 rounded border border-blue-700 bg-blue-700 text-white text-sm hover:bg-blue-800 disabled:opacity-60" disabled={syncState === 'loading'} onClick={() => onSyncGrade(quizId)}>
            {syncState === 'loading' ? 'Submitting...' : syncState === 'success' ? 'Submit again to Canvas' : 'Submit to Canvas'}
          </button>
          {syncMessage && <div className={`mt-2 text-sm ${syncState === 'error' ? 'text-red-700' : 'text-blue-800'}`}>{syncMessage}</div>}
        </div>
      )}
    </div>
  );
}
