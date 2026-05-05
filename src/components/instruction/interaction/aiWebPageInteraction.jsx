import React from 'react';
import { useInteractionProgressStore, updateInteractionProgress } from './interactionProgressStore';
import inlineLiteMarkdown from './inlineLiteMarkdown';
import WebPageInteraction from './webPageInteraction';

function fmtDate(d) {
  return new Date(d).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

function normalizeGeneratedHtml(response) {
  return (response || '')
    .trim()
    .replace(/^```(?:html)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function parseBody(body = '') {
  const lines = body.split(/\r?\n/);
  const fenceStartIndex = lines.findIndex((line) => /^\s*(`{3,}|~{3,})\s*html\s*$/i.test(line));

  if (fenceStartIndex < 0) {
    return { directions: body.trim(), html: '' };
  }

  const startMatch = lines[fenceStartIndex].match(/^\s*(`{3,}|~{3,})\s*html\s*$/i);
  const fenceToken = startMatch ? startMatch[1] : '```';
  const fenceChar = fenceToken[0];
  const minFenceLen = fenceToken.length;
  let fenceEndIndex = -1;

  for (let i = fenceStartIndex + 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    const closeMatch = line.match(/^(`+|~+)\s*$/);
    if (closeMatch && closeMatch[1][0] === fenceChar && closeMatch[1].length >= minFenceLen) {
      fenceEndIndex = i;
      break;
    }
  }

  if (fenceEndIndex < 0) {
    return { directions: body.trim(), html: '' };
  }

  const html = normalizeGeneratedHtml(lines.slice(fenceStartIndex + 1, fenceEndIndex).join('\n'));
  const directions = [...lines.slice(0, fenceStartIndex), ...lines.slice(fenceEndIndex + 1)].join('\n').trim();
  return { directions, html };
}

function resolveWebPageUrl(file, topicPath) {
  if (!file || !topicPath) return null;

  try {
    const url = new URL(file, topicPath);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export default function AiWebPageInteraction({ id, title, body, height, topicPath, file, allowAiPrompt = true, getSubmissionHistory }) {
  const progress = useInteractionProgressStore(id) || {};
  const { directions, html: htmlFromBody } = React.useMemo(() => parseBody(body), [body]);

  const [fileHtml, setFileHtml] = React.useState('');
  const [loadingFileHtml, setLoadingFileHtml] = React.useState(false);
  const [fileLoadError, setFileLoadError] = React.useState('');

  const currentHtml = progress.html || htmlFromBody || fileHtml || '';
  const [currentPrompt, setCurrentPrompt] = React.useState(progress.prompt || '');
  const [sourceOpen, setSourceOpen] = React.useState(true);
  const [sourceValue, setSourceValue] = React.useState(currentHtml);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [historyItems, setHistoryItems] = React.useState(null);
  const [localHistoryItems, setLocalHistoryItems] = React.useState([]);
  const [historyIndex, setHistoryIndex] = React.useState(-1);

  const mergedHistoryItems = React.useMemo(() => {
    const serverItems = historyItems || [];
    if (localHistoryItems.length === 0) return serverItems;

    const merged = [...localHistoryItems];
    const hasMatch = (candidate, existing) => {
      const candidateKey = candidate?.details?.submissionKey;
      const existingKey = existing?.details?.submissionKey;
      if (candidateKey && existingKey) return candidateKey === existingKey;
      return candidate?.createdAt === existing?.createdAt && candidate?.details?.html === existing?.details?.html && candidate?.details?.prompt === existing?.details?.prompt;
    };

    serverItems.forEach((serverItem) => {
      if (!merged.some((localItem) => hasMatch(serverItem, localItem))) {
        merged.push(serverItem);
      }
    });

    merged.sort((a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime());
    return merged;
  }, [historyItems, localHistoryItems]);

  React.useEffect(() => {
    const src = resolveWebPageUrl(file, topicPath);
    if (!src) {
      setFileHtml('');
      setFileLoadError('');
      setLoadingFileHtml(false);
      return;
    }

    const controller = new AbortController();
    setLoadingFileHtml(true);
    setFileLoadError('');

    fetch(src, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Unable to load ${src}`);
        }
        return response.text();
      })
      .then((html) => {
        setFileHtml(normalizeGeneratedHtml(html));
        setLoadingFileHtml(false);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setFileHtml('');
          setFileLoadError('Unable to load starter HTML from file.');
          setLoadingFileHtml(false);
        }
      });

    return () => controller.abort();
  }, [file, topicPath]);

  React.useEffect(() => {
    setSourceValue(currentHtml);
  }, [currentHtml]);

  React.useEffect(() => {
    setCurrentPrompt(progress.prompt || '');
  }, [progress.prompt]);

  React.useEffect(() => {
    if (!progress?.submissionKey || !progress?.html) return;

    const historyItem = {
      id: `local-${progress.submissionKey}`,
      createdAt: progress.submittedAt || new Date().toISOString(),
      details: {
        type: 'ai-web-page',
        submissionKey: progress.submissionKey,
        prompt: progress.prompt || '',
        html: progress.html,
        percentCorrect: progress.percentCorrect,
        feedback: progress.feedback,
        gradingCriteria: progress.gradingCriteria,
      },
    };

    setLocalHistoryItems((prev) => {
      if (prev.some((item) => item?.details?.submissionKey === progress.submissionKey)) {
        return prev;
      }
      return [historyItem, ...prev];
    });
  }, [progress]);

  async function toggleHistory() {
    if (historyOpen) {
      setHistoryOpen(false);
      return;
    }

    setHistoryOpen(true);
    if (getSubmissionHistory) {
      const items = (await getSubmissionHistory()) || [];
      setHistoryItems(items);
      setHistoryIndex(items.length > 0 || localHistoryItems.length > 0 ? 0 : -1);
    }
  }

  function applyHistory(item) {
    if (!item?.details?.html) return;

    const updated = {
      ...progress,
      prompt: item.details?.prompt || '',
      html: item.details.html,
      submittedHtml: item.details?.submittedHtml || item.details?.html,
      feedback: item.details?.feedback,
      percentCorrect: item.details?.percentCorrect,
      gradingCriteria: item.details?.gradingCriteria,
      generationState: 'idle',
      generationFeedback: '',
    };
    updateInteractionProgress(id, updated);
    setCurrentPrompt(item.details?.prompt || '');
    setSourceValue(item.details.html);
  }

  function applySource() {
    if (!sourceValue.trim()) return;

    updateInteractionProgress(id, {
      ...progress,
      prompt: currentPrompt,
      html: sourceValue,
      generationState: 'idle',
      generationFeedback: '',
    });
  }

  function loadHistoryByOffset(offset) {
    if (!mergedHistoryItems || mergedHistoryItems.length === 0) return;

    const next = Math.min(mergedHistoryItems.length - 1, Math.max(0, historyIndex + offset));
    setHistoryIndex(next);
    applyHistory(mergedHistoryItems[next]);
  }

  const generationState = progress.generationState || 'idle';
  const generationFeedback = progress.generationFeedback || '';
  const canApplySource = sourceValue.trim() && sourceValue !== currentHtml;
  const promptDisabled = !currentPrompt.trim() || generationState === 'loading';
  const lastSubmittedHtml = progress.submittedHtml || (progress.feedback ? progress.html : '');
  const hasSourceChangesForSubmit = !lastSubmittedHtml || currentHtml !== lastSubmittedHtml;
  const submitDisabled = !currentHtml.trim() || generationState === 'loading' || !hasSourceChangesForSubmit;
  const saveDisabled = !canApplySource || generationState === 'loading';

  const loadingHistory = historyOpen && historyItems === null && Boolean(getSubmissionHistory);
  const noHistory = historyOpen && mergedHistoryItems.length === 0;
  const hasHistory = historyOpen && mergedHistoryItems.length > 0;

  const selectedHistoryItem = mergedHistoryItems && historyIndex >= 0 ? mergedHistoryItems[historyIndex] : null;
  const selectedHistoryDate = selectedHistoryItem ? fmtDate(selectedHistoryItem.createdAt) : '';
  const selectedHistoryScore = selectedHistoryItem?.details?.percentCorrect;

  const generationClasses = generationState === 'error' ? 'mt-3 p-3 border rounded bg-red-50 text-red-900' : generationState === 'loading' ? 'mt-3 p-3 border rounded bg-blue-50 text-blue-900 opacity-75 animate-pulse' : 'mt-3 p-3 border rounded bg-blue-50 text-blue-900';

  const effectiveDirections = directions || 'Build and submit an HTML page. Use the editor to modify the current page before submitting.';

  return (
    <div>
      <div className="mb-3 break-words whitespace-pre-line" data-plugin-masteryls-body>
        {inlineLiteMarkdown(effectiveDirections)}
      </div>

      {loadingFileHtml && !currentHtml && <div className="text-sm text-gray-500">Loading starter HTML...</div>}
      {fileLoadError && <div className="text-sm text-red-700">{fileLoadError}</div>}

      {allowAiPrompt && (
        <div className="mt-3 space-y-2">
          <div className="text-xs text-gray-600">Use AI to generate or revise HTML from a natural-language prompt.</div>
          <textarea name={`interaction-${id}`} className="w-full h-28 p-3 border bg-white border-gray-300 rounded-lg resize-y transition-colors duration-200 placeholder-gray-400" placeholder="Describe the web page you want to generate ..." value={currentPrompt} onChange={(e) => setCurrentPrompt(e.target.value)}></textarea>
          <button id={`generate-${id}`} type="button" className="px-6 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 transition-colors duration-200" disabled={promptDisabled}>
            {currentHtml ? 'Execute prompt' : 'Generate page'}
          </button>
        </div>
      )}

      {generationState !== 'idle' && generationFeedback && <div className={generationClasses}>{inlineLiteMarkdown(generationFeedback)}</div>}

      <div className="mt-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="px-4 py-1 border border-gray-300 bg-white text-gray-800 rounded-lg hover:bg-gray-100 transition-colors duration-200" onClick={() => setSourceOpen((open) => !open)}>
            {sourceOpen ? 'Hide HTML source' : 'Show HTML source'}
          </button>

          {sourceOpen && (
            <button id={`save-source-${id}`} type="button" className="px-4 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 transition-colors duration-200" disabled={saveDisabled} onClick={applySource}>
              Apply HTML changes
            </button>
          )}

          <button id={`submit-${id}`} type="submit" className="px-4 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 transition-colors duration-200" disabled={submitDisabled}>
            Submit
          </button>
          {!hasSourceChangesForSubmit && (
            <span className="text-xs text-gray-500">Update the HTML source before submitting again.</span>
          )}
        </div>

        {sourceOpen && <textarea className="w-full h-72 p-3 border bg-gray-950 text-gray-100 border-gray-700 rounded-lg resize-y font-mono text-sm leading-5 transition-colors duration-200" data-plugin-masteryls-ai-web-page-source value={sourceValue} placeholder={`<!doctype html>\n<html>\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  </head>\n  <body>\n  </body>\n</html>`} spellCheck="false" onChange={(e) => setSourceValue(e.target.value)} />}

        {currentHtml ? <WebPageInteraction title={title || 'AI web page'} html={currentHtml} height={height} topicPath={topicPath} /> : <div className="text-sm text-gray-500 border border-dashed border-gray-300 rounded-lg p-3">No HTML available yet. Add HTML in the editor or generate it from a prompt.</div>}

        {getSubmissionHistory && (
          <div className="border border-blue-200 bg-blue-50/40 rounded-lg p-3 space-y-2">
            <button type="button" onClick={toggleHistory} aria-expanded={historyOpen} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-200 bg-blue-50 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors duration-200">
              <span aria-hidden="true" className="text-xs leading-none">
                {historyOpen ? '▾' : '▸'}
              </span>
              {historyOpen ? 'Collapse submission history' : 'Expand submission history'}
              {mergedHistoryItems.length > 0 && <span className="inline-flex items-center justify-center rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">{mergedHistoryItems.length}</span>}
            </button>

            {loadingHistory && <p className="text-sm text-gray-500 py-1">Loading...</p>}
            {noHistory && <p className="text-sm text-gray-500 py-1">No submissions found.</p>}

            {hasHistory && (
              <div className="space-y-2 border border-blue-100 bg-white rounded-lg p-2">
                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
                  <button type="button" className="px-3 py-1 border border-gray-300 bg-white rounded hover:bg-gray-100 disabled:bg-gray-100 disabled:text-gray-400" disabled={historyIndex <= 0} onClick={() => loadHistoryByOffset(-1)}>
                    Newer
                  </button>
                  <button type="button" className="px-3 py-1 border border-gray-300 bg-white rounded hover:bg-gray-100 disabled:bg-gray-100 disabled:text-gray-400" disabled={historyIndex >= mergedHistoryItems.length - 1} onClick={() => loadHistoryByOffset(1)}>
                    Older
                  </button>
                  <span>{`Submission ${historyIndex + 1} of ${mergedHistoryItems.length}`}</span>
                  {selectedHistoryDate && <span className="text-gray-500">{selectedHistoryDate}</span>}
                  {selectedHistoryScore != null && <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">{selectedHistoryScore}%</span>}
                </div>

                <div className="h-[120px] overflow-y-auto space-y-1 pr-1">
                  {mergedHistoryItems.map((item, i) => (
                    <button
                      key={item.id || i}
                      type="button"
                      data-plugin-masteryls-history-item
                      onClick={() => {
                        setHistoryIndex(i);
                        applyHistory(item);
                      }}
                      className={`w-full text-left border rounded px-3 py-1 text-sm transition-colors duration-200 flex items-center justify-between ${currentHtml === item.details?.html ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                    >
                      <span className="text-gray-700">{fmtDate(item.createdAt)}</span>
                      {item.details?.percentCorrect != null && <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">{item.details.percentCorrect}%</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
