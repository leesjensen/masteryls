import React from 'react';
import { useInteractionProgressStore, updateInteractionProgress } from './interactionProgressStore';
import inlineLiteMarkdown from './inlineLiteMarkdown';
import WebPageInteraction from './webPageInteraction';

function scoreColor(pct) {
  if (pct == null) return 'text-gray-500';
  if (pct >= 80) return 'text-green-600';
  if (pct >= 50) return 'text-yellow-600';
  return 'text-red-600';
}

function fmtDate(d) {
  return new Date(d).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

export default function AiWebPageInteraction({ id, title, body, height, topicPath, getSubmissionHistory }) {
  const progress = useInteractionProgressStore(id) || {};
  const value = progress.prompt || '';
  const generatedHtml = progress.html || '';
  const [currentValue, setCurrentValue] = React.useState(value);
  const [sourceOpen, setSourceOpen] = React.useState(false);
  const [sourceValue, setSourceValue] = React.useState(generatedHtml);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [historyItems, setHistoryItems] = React.useState(null);
  React.useEffect(() => {
    setSourceValue(generatedHtml);
  }, [generatedHtml]);

  async function toggleHistory() {
    if (historyOpen) {
      setHistoryOpen(false);
    } else {
      setHistoryOpen(true);
      if (historyItems === null && getSubmissionHistory) {
        const items = await getSubmissionHistory();
        setHistoryItems(items);
      }
    }
  }

  function applyHistory(item) {
    if (item.details?.html) {
      updateInteractionProgress(id, { ...progress, html: item.details.html });
    }
  }

  return (
    <div>
      <div className="mb-3 break-words whitespace-pre-line" data-plugin-masteryls-body>
        {inlineLiteMarkdown(body)}
      </div>
      <textarea name={`interaction-${id}`} className="w-full h-32 p-3 border bg-white border-gray-300 rounded-lg resize-y transition-colors duration-200 placeholder-gray-400" placeholder="Describe the web page you want to generate ..." defaultValue={value} onChange={(e) => setCurrentValue(e.target.value)}></textarea>
      <button id={`generate-${id}`} type="button" className="mt-3 px-6 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 transition-colors duration-200" disabled={!currentValue.trim()}>
        {generatedHtml ? 'Execute prompt' : 'Generate page'}
      </button>
      {generatedHtml && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="px-4 py-1 border border-gray-300 bg-white text-gray-800 rounded-lg hover:bg-gray-100 transition-colors duration-200" onClick={() => setSourceOpen((open) => !open)}>
              {sourceOpen ? 'Hide source' : 'View source'}
            </button>
            {sourceOpen && (
              <button id={`save-source-${id}`} type="button" className="px-4 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 transition-colors duration-200" disabled={!sourceValue.trim() || sourceValue === generatedHtml}>
                Apply source
              </button>
            )}
            <button id={`submit-${id}`} type="submit" className="px-4 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200">
              Submit
            </button>
          </div>
          {sourceOpen && <textarea className="w-full h-72 p-3 border bg-gray-950 text-gray-100 border-gray-700 rounded-lg resize-y font-mono text-sm leading-5 transition-colors duration-200" data-plugin-masteryls-ai-web-page-source value={sourceValue} spellCheck="false" onChange={(e) => setSourceValue(e.target.value)} />}
          <WebPageInteraction title={title || 'Generated web page'} html={generatedHtml} height={height} topicPath={topicPath} />

          {getSubmissionHistory && (
            <div className="border-t border-gray-200 pt-3 space-y-1">
              <button type="button" onClick={toggleHistory} className="text-sm text-blue-600 hover:text-blue-800 transition-colors duration-200">
                {historyOpen ? 'Hide previous submissions' : 'Previous submissions'}
              </button>
              {historyOpen && (
                <div className="h-[100px] overflow-y-auto space-y-1 pr-1">
                  {historyItems === null ? (
                    <p className="text-sm text-gray-400 py-1">Loading…</p>
                  ) : historyItems.length === 0 ? (
                    <p className="text-sm text-gray-400 py-1">No previous submissions found.</p>
                  ) : (
                    historyItems.map((item, i) => (
                      <button key={item.id || i} type="button" data-plugin-masteryls-history-item onClick={() => applyHistory(item)} className={`w-full text-left border rounded px-3 py-1 text-sm transition-colors duration-200 flex justify-between items-center ${generatedHtml === item.details?.html ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                        <span className="text-gray-700">{fmtDate(item.createdAt)}</span>
                        {item.details?.percentCorrect != null && (
                          <span className={`font-medium ${scoreColor(item.details.percentCorrect)}`}>{item.details.percentCorrect}%</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
