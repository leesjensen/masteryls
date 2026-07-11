import React from 'react';
import { DimensionCard, getRatingTone, formatWholeNumber } from '../../shared/EvaluationDimension';
import { calculateAttributeScore, scoreToRatingLevel } from '../dra/draScore';

function computeInterviewScore(evaluation, difficulty = 3) {
  if (!evaluation) return null;

  const sessions = evaluation.sessions || [];
  let sessionScore = 0;
  if (sessions.length > 0) {
    const scored = sessions.map((s) => calculateAttributeScore(s, 'Beginning', difficulty));
    sessionScore = scored.reduce((sum, s) => sum + s.supportedScore, 0) / scored.length;
  }

  const competencyAttrs = (evaluation.competency?.attributes || []).map((a) => ({ ...a, calculation: calculateAttributeScore(a, evaluation.competency?.rating || 'Beginning', difficulty) }));
  const dispositionAttrs = (evaluation.disposition?.attributes || []).map((a) => ({ ...a, calculation: calculateAttributeScore(a, evaluation.disposition?.rating || 'Beginning', difficulty) }));

  const competencyScore = competencyAttrs.length > 0 ? competencyAttrs.reduce((s, a) => s + a.calculation.supportedScore, 0) / competencyAttrs.length : 0;
  const dispositionScore = dispositionAttrs.length > 0 ? dispositionAttrs.reduce((s, a) => s + a.calculation.supportedScore, 0) / dispositionAttrs.length : 0;

  const characterScore = (competencyScore + dispositionScore) / 2;
  const processMultiplier = 0.5 + 0.5 * (characterScore / 100);
  const rawScore = sessionScore * processMultiplier;

  return {
    rawScore,
    score: Math.round(rawScore),
    level: scoreToRatingLevel(rawScore),
    sessionScore,
    competency: { score: competencyScore, displayedLevel: scoreToRatingLevel(competencyScore), summary: evaluation.competency?.summary || '', attributes: competencyAttrs, evidenceStats: { count: competencyAttrs.reduce((s, a) => s + a.calculation.evidenceStats.count, 0), positiveSupport: 0, negativeSupport: 0, netSupport: 0 } },
    disposition: { score: dispositionScore, displayedLevel: scoreToRatingLevel(dispositionScore), summary: evaluation.disposition?.summary || '', attributes: dispositionAttrs, evidenceStats: { count: dispositionAttrs.reduce((s, a) => s + a.calculation.evidenceStats.count, 0), positiveSupport: 0, negativeSupport: 0, netSupport: 0 } },
    characterScore,
    processMultiplier,
  };
}

function SessionCard({ session, difficulty }) {
  const [open, setOpen] = React.useState(false);
  const calc = calculateAttributeScore(session, 'Beginning', difficulty);
  const tone = getRatingTone(calc.displayedLevel);
  const hasEvidence = (session.evidence || []).length > 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <button type="button" className="w-full px-4 py-3 text-left" onClick={() => setOpen((v) => !v)}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-gray-900">{session.sessionId || session.title || 'Session'}</div>
            {session.summary && <div className="mt-0.5 text-xs text-gray-600">{session.summary}</div>}
          </div>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone.chip}`}>{calc.displayedLevel}</span>
        </div>
        <div className="mt-1 text-[11px] text-gray-500">Score {formatWholeNumber(calc.supportedScore)} / 100</div>
      </button>
      {open && hasEvidence && (
        <div className="border-t border-gray-100 px-4 py-3">
          <ul className="list-disc space-y-1 pl-4 text-xs text-gray-600">
            {(session.evidence || []).map((item, i) => (
              <li key={i}>{item.detail}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function InterviewEvaluation({ evaluation, difficulty = 3 }) {
  if (!evaluation) return null;

  const result = computeInterviewScore(evaluation, difficulty);
  if (!result) return null;

  const overallTone = getRatingTone(result.level);

  return (
    <div className="not-prose space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-4 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Evaluation Snapshot</div>
        <div className="mt-1 flex items-center gap-3">
          <div className="text-2xl font-bold text-gray-900">{formatWholeNumber(result.rawScore)} / 100</div>
          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${overallTone.chip}`}>{result.level}</span>
          <span className="rounded-full border border-gray-300 bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">Difficulty {difficulty}</span>
        </div>
        <div className="mt-2 text-sm text-gray-600">Interview performance is the main driver. Character (Competency and Disposition) shapes how much of that score counts.</div>
      </div>

      {(evaluation.sessions || []).length > 0 && (
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Interview Sessions</div>
          {evaluation.sessions.map((s, i) => (
            <SessionCard key={i} session={s} difficulty={difficulty} />
          ))}
        </div>
      )}

      <div className="space-y-3">
        <DimensionCard label="Competency" dimension={result.competency} defaultOpen />
        <DimensionCard label="Disposition" dimension={result.disposition} />
      </div>
    </div>
  );
}
