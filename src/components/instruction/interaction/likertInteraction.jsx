import React from 'react';
import inlineLiteMarkdown from './inlineLiteMarkdown';
import { useInteractionProgressStore } from './interactionProgressStore';
import { canViewLikertResults, parseLikertBody } from '../../../utils/likertInteraction';

function parseVisibilityMode(showResults) {
  const normalized = String(showResults || '')
    .trim()
    .toLowerCase();
  return normalized === 'always' ? 'always' : 'editor';
}

export default function LikertInteraction({ id, body, meta, courseOps }) {
  const progress = useInteractionProgressStore(id) || {};
  const { prompt, questions, scale } = parseLikertBody(body, meta);
  const visibilityMode = parseVisibilityMode(meta?.showResults || meta?.resultsVisibility);
  const canViewResults = canViewLikertResults(visibilityMode, courseOps?.user);
  const required =
    String(meta?.required ?? 'true')
      .trim()
      .toLowerCase() !== 'false';

  const initialResponses = progress.responses || {};
  const [responses, setResponses] = React.useState(initialResponses);
  const [summary, setSummary] = React.useState(null);

  const answeredCount = questions.filter((question) => Number.isFinite(Number(responses[question.qid]))).length;
  const allAnswered = questions.length > 0 && answeredCount === questions.length;

  function handleSelect(questionId, value) {
    setResponses((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  }

  function loadSummary() {
    if (!canViewResults || !questions.length) return;
    courseOps.getLikertSummary(id, { questions, scaleValues: scale.values }).then((data) => {
      setSummary(data);
    });
  }

  React.useEffect(() => {
    if (canViewResults) {
      loadSummary();
    }
  }, []);

  return (
    <>
      <div className="mb-3 break-words whitespace-pre-line" data-plugin-masteryls-body>
        {inlineLiteMarkdown(prompt)}
      </div>
      <div className="space-y-4">
        {questions.map((question) => (
          <div key={question.qid} className="border border-gray-200 rounded p-3">
            <div className="font-medium text-sm mb-2">{inlineLiteMarkdown(question.text)}</div>
            <div className="flex flex-wrap gap-3">
              {scale.values.map((value) => {
                const selected = Number(responses[question.qid]) === value;
                return (
                  <label key={value} className="cursor-pointer inline-flex items-center gap-1 text-sm">
                    <input type="radio" name={`likert-${id}-${question.qid}`} value={value} checked={selected} onChange={() => handleSelect(question.qid, value)} data-plugin-masteryls-likert-question={question.qid} data-plugin-masteryls-likert-value={value} />
                    <span>{scale.labels[value]}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}

        <button id={`submit-${id}`} type="submit" className="mt-3 px-6 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 transition-colors duration-200" disabled={required && !allAnswered}>
          Submit
        </button>

        {canViewResults && (
          <details className="mt-4 border rounded bg-blue-50 border-blue-700">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-800">Results</summary>
            <div className="px-4 pb-4">
              <div className="flex justify-end mb-3">
                <button className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700" onClick={loadSummary}>
                  Refresh
                </button>
              </div>
              {!summary && <div className="text-sm text-gray-500">No responses yet.</div>}
              {summary && (
                <div className="space-y-4">
                  {summary.questions.map((item) => {
                    const maxCount = Math.max(1, ...Object.values(item.counts));
                    return (
                      <div key={item.qid}>
                        <div className="flex justify-between mb-1 items-end">
                          <span className="font-medium text-gray-700 flex-1 mr-4">{inlineLiteMarkdown(item.text)}</span>
                          <span className="text-xs text-gray-500 whitespace-nowrap">
                            Avg {item.average} ({item.responses} responses)
                          </span>
                        </div>
                        <div className="space-y-1">
                          {scale.values.map((value) => {
                            const count = item.counts[value] || 0;
                            const width = Math.round((count / maxCount) * 100);
                            return (
                              <div key={value} className="text-xs">
                                <div className="flex justify-between text-gray-600 mb-0.5 gap-2">
                                  <span className="truncate">{scale.labels[value]}</span>
                                  <span>{count}</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                  <div className="bg-amber-400 h-full transition-all duration-700 ease-out" style={{ width: `${width}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  <div className="pt-2 border-t text-right text-xs text-gray-500">
                    Overall average: {summary.overallAverage} | Total respondents: {summary.voters}
                  </div>
                </div>
              )}
            </div>
          </details>
        )}
      </div>
    </>
  );
}
