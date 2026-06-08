import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkEmoji from 'remark-emoji';
import remarkGithubBlockquoteAlert from 'remark-github-blockquote-alert';
import { useInteractionProgressStore } from './interactionProgressStore';
import ScoreStars from './scoreStars';

export default function InteractionFeedback({ quizId, onSyncGrade = null, isCourseLinkedToGradebook = false, canSubmitToGradebook = true }) {
  const details = useInteractionProgressStore(quizId);
  if (!details || !details.feedback) {
    return null;
  }

  const percentCorrect = Number(details?.percentCorrect);
  const canSyncGrade = details?.syncGrade === true && isCourseLinkedToGradebook === true && canSubmitToGradebook === true && Number.isFinite(percentCorrect) && typeof onSyncGrade === 'function';
  const syncState = details?.canvasSyncState || 'idle';
  const syncMessage = details?.canvasSyncMessage || null;

  return (
    <div className="mt-4 p-3 border rounded bg-white text-blue-900 relative">
      {details.percentCorrect !== undefined && (
        <div className="absolute bottom-1 right-2 ">
          <ScoreStars percent={details.percentCorrect} />
        </div>
      )}
      <div className="markdown-body whitespace-normal">
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkEmoji, remarkGithubBlockquoteAlert]}>{details.feedback}</ReactMarkdown>
      </div>
      {canSyncGrade && (
        <div className="mt-3">
          <button type="button" className="px-3 py-1.5 rounded border border-blue-700 bg-blue-700 text-white text-sm hover:bg-blue-800 disabled:opacity-60" disabled={syncState === 'loading'} onClick={() => onSyncGrade(quizId)}>
            {syncState === 'loading' ? 'Submitting...' : syncState === 'success' ? 'Submit again to Gradebook' : 'Submit to Gradebook'}
          </button>
          {syncMessage && <div className={`mt-2 text-sm ${syncState === 'error' ? 'text-red-700' : 'text-blue-800'}`}>{syncMessage}</div>}
        </div>
      )}
    </div>
  );
}
