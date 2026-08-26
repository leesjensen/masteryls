import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkEmoji from 'remark-emoji';
import remarkGithubBlockquoteAlert from 'remark-github-blockquote-alert';
import { RefreshCw } from 'lucide-react';
import { formatFileSize } from '../../../utils/utils';

function parseChoiceLabels(body = '') {
  return body
    .split('\n')
    .filter((line) => /^\s*-\s*\[[ xX]\]/.test(line))
    .map((line) => line.replace(/^\s*-\s*\[[ xX]\]\s*/, '').trim());
}

function responseDate(response) {
  const date = new Date(response.createdAt || 0);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function getLatestResponses(progressRows) {
  const latestByUser = new Map();
  for (const row of progressRows || []) {
    if (!row?.userId) continue;
    const current = latestByUser.get(row.userId);
    if (!current || responseDate(row) > responseDate(current)) {
      latestByUser.set(row.userId, row);
    }
  }
  return [...latestByUser.values()];
}

function ResponseDetails({ response, interactionType, body, getSubmissionFileUrl }) {
  const details = response?.details || {};
  const type = String(details.type || interactionType || '').toLowerCase();
  const choiceLabels = parseChoiceLabels(body);

  if (type === 'multiple-choice' || type === 'multiple-select' || type === 'survey') {
    const selected = Array.isArray(details.selected) ? details.selected : [];
    const correct = new Set(Array.isArray(details.correct) ? details.correct : []);
    return (
      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Selected answers</div>
        {selected.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-gray-800">
            {selected.map((index) => (
              <li key={index}>
                {choiceLabels[index] || `Option ${Number(index) + 1}`}
                {correct.has(index) && <span className="ml-2 text-green-700">(correct)</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm italic text-gray-500">No answer selected.</p>
        )}
      </div>
    );
  }

  if (type === 'likert') {
    const responses = details.responses && typeof details.responses === 'object' ? details.responses : {};
    return (
      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Responses</div>
        {Object.keys(responses).length > 0 ? (
          <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 text-sm">
            {Object.entries(responses).map(([question, value]) => (
              <React.Fragment key={question}>
                <dt className="truncate text-gray-700">{question}</dt>
                <dd className="font-medium text-gray-900">{String(value)}</dd>
              </React.Fragment>
            ))}
          </dl>
        ) : (
          <p className="text-sm italic text-gray-500">No responses recorded.</p>
        )}
      </div>
    );
  }

  if (type === 'essay') {
    return <ResponseText label="Essay response" value={details.essay} />;
  }

  if (type === 'prompt') {
    return <ResponseText label="Prompt" value={details.prompt} />;
  }

  if (type === 'url-submission' || type === 'github-submission') {
    return (
      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Submitted URL</div>
        <a href={details.url} target="_blank" rel="noreferrer" className="break-all text-sm text-blue-700 hover:underline">
          {details.url || 'No URL submitted'}
        </a>
      </div>
    );
  }

  if (type === 'file-submission') {
    const files = Array.isArray(details.files) ? details.files : [];
    return (
      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Submitted files</div>
        {files.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {files.map((file, index) => (
              <li key={`${file.storagePath || file.name}-${index}`}>
                {file.storagePath && typeof getSubmissionFileUrl === 'function' ? (
                  <button
                    type="button"
                    className="text-blue-700 hover:underline"
                    onClick={async () => {
                      const url = await getSubmissionFileUrl(file.storagePath);
                      if (url) window.open(url, '_blank', 'noopener,noreferrer');
                    }}
                  >
                    {file.name || 'Download file'}
                  </button>
                ) : (
                  <span>{file.name || 'Unnamed file'}</span>
                )}{' '}
                <span className="text-xs text-gray-500">({formatFileSize(file.size || 0)})</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm italic text-gray-500">No files submitted.</p>
        )}
      </div>
    );
  }

  if (type === 'teaching') {
    const messages = Array.isArray(details.messages) ? details.messages : [];
    return (
      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Conversation</div>
        <div className="space-y-2">
          {messages.map((message, index) => (
            <div key={`${message.timestamp || index}-${index}`} className={`rounded border px-3 py-2 text-sm ${message.type === 'user' ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}>
              <div className="mb-1 text-xs font-semibold uppercase text-gray-500">{message.type === 'user' ? 'Learner' : 'AI'}</div>
              <div className="max-h-[12.5rem] overflow-y-auto whitespace-pre-wrap">{message.content}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'ai-web-page') {
    return <ResponseText label="Generated HTML" value={details.html} />;
  }

  return <ResponseText label="Response details" value={JSON.stringify(details, null, 2)} />;
}

function ResponseText({ label, value }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className="max-h-[12.5rem] overflow-y-auto whitespace-pre-wrap break-words rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800">{value || 'No response recorded.'}</div>
    </div>
  );
}

export default function InteractionResponseReview({ courseOps, courseId, topicId, interactionId, interactionType, body }) {
  const user = courseOps?.user;
  const canReview = Boolean(user && (user.isRoot() || user.isEditor(courseId)));
  const [isOpen, setIsOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [responses, setResponses] = React.useState([]);
  const [learnersById, setLearnersById] = React.useState(new Map());
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [hasLoaded, setHasLoaded] = React.useState(false);

  if (!canReview) return null;

  async function loadResponses() {
    setLoading(true);
    setError(null);
    try {
      const [progressResult, learners] = await Promise.all([
        courseOps.getProgress({ courseId, topicId, interactionId, types: ['quizSubmit'], limit: 1000 }),
        typeof courseOps.service?.getEnrolledUsersForCourse === 'function' ? courseOps.service.getEnrolledUsersForCourse(courseId).catch(() => []) : Promise.resolve([]),
      ]);

      const latest = getLatestResponses(progressResult?.data || []);
      const userMap = new Map((learners || []).map((learner) => [learner.id, learner]));
      latest.sort((a, b) => {
        const aLearner = userMap.get(a.userId);
        const bLearner = userMap.get(b.userId);
        const aLabel = aLearner?.name || aLearner?.email || a.userId;
        const bLabel = bLearner?.name || bLearner?.email || b.userId;
        return String(aLabel).localeCompare(String(bLabel));
      });
      setResponses(latest);
      setLearnersById(userMap);
      setSelectedIndex(0);
      setHasLoaded(true);
    } catch (loadError) {
      setError(loadError?.message || 'Unable to load learner responses.');
    } finally {
      setLoading(false);
    }
  }

  async function toggleResponses() {
    if (isOpen) {
      setIsOpen(false);
      return;
    }

    setIsOpen(true);
    if (!hasLoaded) await loadResponses();
  }

  const currentResponse = responses[selectedIndex];
  const currentLearner = currentResponse ? learnersById.get(currentResponse.userId) : null;
  const learnerLabel = currentLearner?.name || currentLearner?.email || currentResponse?.userId || 'Unknown learner';
  const details = currentResponse?.details || {};
  const score = Number(details.percentCorrect);

  return (
    <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50/50">
      <button type="button" aria-expanded={isOpen} onClick={(event) => { event.stopPropagation(); toggleResponses(); }} className="w-full px-3 py-2 text-left text-sm font-semibold text-indigo-900 hover:bg-indigo-100">
        {isOpen ? 'Hide learner responses' : hasLoaded ? `Show learner responses (${responses.length})` : 'Show learner responses'}
      </button>

      {isOpen && (
        <div className="border-t border-indigo-200 px-3 pb-3 pt-2" onClick={(event) => event.stopPropagation()}>
          {loading && <div className="py-3 text-sm text-gray-600">Loading learner responses…</div>}
          {!loading && error && <div className="py-3 text-sm text-red-700">{error}</div>}
          {!loading && !error && responses.length === 0 && <div className="py-3 text-sm text-gray-600">No learner responses yet.</div>}
          {!loading && !error && currentResponse && (
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="font-semibold text-gray-900">{learnerLabel}</div>
                  </div>
                  {currentLearner?.email && currentLearner.email !== learnerLabel && <div className="text-xs text-gray-500">{currentLearner.email}</div>}
                  <div className="text-xs text-gray-500">Submitted {new Date(currentResponse.createdAt).toLocaleString()}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={loadResponses} disabled={loading} aria-label="Refresh responses" title="Refresh responses" className="inline-flex items-center justify-center rounded border border-gray-300 bg-white p-1 text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50">
                    <RefreshCw size={14} aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => setSelectedIndex((index) => Math.max(0, index - 1))} disabled={selectedIndex === 0} className="rounded border border-gray-300 bg-white px-2 py-1 text-xs hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50">Previous</button>
                  <span className="text-xs tabular-nums text-gray-600">{selectedIndex + 1} of {responses.length}</span>
                  <button type="button" onClick={() => setSelectedIndex((index) => Math.min(responses.length - 1, index + 1))} disabled={selectedIndex === responses.length - 1} className="rounded border border-gray-300 bg-white px-2 py-1 text-xs hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50">Next</button>
                </div>
              </div>

              <ResponseDetails response={currentResponse} interactionType={interactionType} body={body} getSubmissionFileUrl={courseOps.getSubmissionFileUrl} />

              {Number.isFinite(score) && <div className="mt-3 text-sm font-medium text-gray-700">Score: {score}%</div>}
              {details.feedback && (
                <div className="markdown-body mt-3 border-t border-indigo-100 pt-3 text-sm">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Feedback</div>
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkEmoji, remarkGithubBlockquoteAlert]}>{details.feedback}</ReactMarkdown>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
