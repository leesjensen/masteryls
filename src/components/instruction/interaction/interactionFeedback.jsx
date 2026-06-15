import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkEmoji from 'remark-emoji';
import remarkGithubBlockquoteAlert from 'remark-github-blockquote-alert';
import { Download } from 'lucide-react';
import { useInteractionProgressStore } from './interactionProgressStore';
import ScoreStars from './scoreStars';
import { formatFileSize } from '../../../utils/utils';

export default function InteractionFeedback({ quizId, onSyncGrade = null, getSubmissionFileUrl = null, isCourseLinkedToGradebook = false, canSubmitToGradebook = true }) {
  const details = useInteractionProgressStore(quizId);
  if (!details || !details.feedback) {
    return null;
  }

  const percentCorrect = Number(details?.percentCorrect);
  const canSyncGrade = details?.syncGrade === true && isCourseLinkedToGradebook === true && canSubmitToGradebook === true && Number.isFinite(percentCorrect) && typeof onSyncGrade === 'function';
  const syncState = details?.canvasSyncState || 'idle';
  const syncMessage = details?.canvasSyncMessage || null;

  const downloadableFiles = Array.isArray(details?.files) ? details.files.filter((f) => f && f.storagePath) : [];

  async function openSubmissionFile(storagePath) {
    if (typeof getSubmissionFileUrl !== 'function') return;
    try {
      const url = await getSubmissionFileUrl(storagePath);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Unable to open submission file', error);
    }
  }

  return (
    <div className="mt-4 p-3 border rounded bg-white text-blue-900 relative">
      {details.percentCorrect !== undefined && (
        <div className="absolute bottom-1 right-2 ">
          <ScoreStars percent={details.percentCorrect} />
        </div>
      )}
      {downloadableFiles.length > 0 && (
        <ul className="mb-3 space-y-1">
          {downloadableFiles.map((f, idx) => (
            <li key={`${f.storagePath || f.name}-${idx}`}>
              <button type="button" onClick={() => openSubmissionFile(f.storagePath)} className="inline-flex items-center gap-1 text-sm text-blue-700 hover:text-blue-900 hover:underline">
                <Download size={14} />
                <span>{f.name}</span>
                <span className="text-xs text-gray-500">({formatFileSize(f.size || 0)})</span>
              </button>
            </li>
          ))}
        </ul>
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
