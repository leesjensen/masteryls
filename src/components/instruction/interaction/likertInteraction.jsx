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

const SEGMENT_COLORS = ['bg-slate-300', 'bg-cyan-400', 'bg-sky-500', 'bg-blue-600', 'bg-indigo-600', 'bg-indigo-700', 'bg-slate-700'];
const AVG_CHIP_COLORS = ['border-slate-300 text-slate-700', 'border-cyan-400 text-cyan-700', 'border-sky-500 text-sky-700', 'border-blue-600 text-blue-700', 'border-indigo-600 text-indigo-700', 'border-indigo-700 text-indigo-800', 'border-slate-700 text-slate-800'];

function getAverageBadgeClass(average, scaleValues) {
  if (!Array.isArray(scaleValues) || scaleValues.length === 0) {
    return AVG_CHIP_COLORS[0];
  }

  const numericAverage = Number(average);
  const sortedScale = [...scaleValues].map(Number).sort((a, b) => a - b);
  let closestIndex = 0;
  let closestDistance = Infinity;

  sortedScale.forEach((value, index) => {
    const distance = Math.abs(value - numericAverage);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  });

  // Keep chip colors aligned with the same ordered palette used by summary segments.
  return AVG_CHIP_COLORS[Math.min(closestIndex, AVG_CHIP_COLORS.length - 1)];
}

function formatAverage(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : '0.00';
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
          <details className="mt-4 rounded-xl border border-blue-700 bg-gradient-to-br from-blue-50 to-slate-100 shadow-sm">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-800">Results</summary>
            <div className="px-4 pb-4">
              {!summary && <div className="text-sm text-gray-500">No responses yet.</div>}
              {summary && (
                <div className="space-y-4">
                  {(() => {
                    return (
                      <>
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-3 py-1.5 text-slate-700">
                            <span className="text-xs text-slate-500">Respondents</span>
                            <span className="font-semibold">{summary.voters}</span>
                          </span>
                          <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-3 py-1.5 text-slate-700">
                            <span className="text-xs text-slate-500">Overall average</span>
                            <span className="font-semibold tabular-nums">{formatAverage(summary.overallAverage)}</span>
                          </span>
                          <button className="sm:ml-auto px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700" onClick={loadSummary}>
                            Refresh
                          </button>
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-white/70 px-3 py-2">
                          <div className="flex flex-wrap gap-3 text-xs text-slate-600">
                            {scale.values.map((value, index) => (
                              <span key={value} className="inline-flex items-center gap-1.5">
                                <span className={`inline-block h-2.5 w-2.5 rounded-full ${SEGMENT_COLORS[index % SEGMENT_COLORS.length]}`} />
                                {scale.labels[value]}
                              </span>
                            ))}
                          </div>
                        </div>

                        {summary.questions.map((item, questionIndex) => {
                          const badgeClass = getAverageBadgeClass(item.average, scale.values);
                          const totalResponses = Math.max(0, item.responses);

                          return (
                            <div key={item.qid} className="rounded-xl border border-slate-200 bg-white/80 p-3 shadow-sm" style={{ animationDelay: `${questionIndex * 50}ms` }}>
                              <div className="mb-2 flex items-start justify-between gap-3">
                                <span className="font-medium text-slate-700">{inlineLiteMarkdown(item.text)}</span>
                                <span className={`whitespace-nowrap rounded-full border bg-white px-2.5 py-1 text-xs font-semibold tabular-nums min-w-[6.5rem] text-center ${badgeClass}`}>Avg {formatAverage(item.average)}</span>
                              </div>

                              <div className="h-4 w-full overflow-hidden rounded-lg bg-slate-100 flex">
                                {scale.values.map((value, index) => {
                                  const count = item.counts[value] || 0;
                                  const percentage = totalResponses > 0 ? (count / totalResponses) * 100 : 0;
                                  return <div key={value} className={`${SEGMENT_COLORS[index % SEGMENT_COLORS.length]} h-full transition-all duration-700 ease-out`} style={{ width: `${percentage}%` }} title={`${scale.labels[value]}: ${count} (${Math.round(percentage)}%)`} />;
                                })}
                              </div>

                              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                                {scale.values.map((value) => {
                                  const count = item.counts[value] || 0;
                                  const percentage = totalResponses > 0 ? Math.round((count / totalResponses) * 100) : 0;
                                  return (
                                    <span key={value} className="rounded-full bg-slate-100 px-2 py-0.5">
                                      {scale.labels[value]}: {count} ({percentage}%)
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </details>
        )}
      </div>
    </>
  );
}
