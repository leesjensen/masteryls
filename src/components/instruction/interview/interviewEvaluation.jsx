import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { DimensionCard, getRatingTone, formatWholeNumber } from '../../shared/EvaluationDimension';
import { calculateAttributeScore, calculateDimensionScore, scoreToRatingLevel } from '../dra/draScore';

const CONCERN_STYLES = {
  Minor: { badge: 'bg-yellow-100 text-yellow-800 border-yellow-300', row: 'border-yellow-200 bg-yellow-50' },
  Moderate: { badge: 'bg-orange-100 text-orange-800 border-orange-300', row: 'border-orange-200 bg-orange-50' },
  Major: { badge: 'bg-red-100 text-red-800 border-red-300', row: 'border-red-200 bg-red-50' },
};

function computeInterviewScore(evaluation, difficulty = 3) {
  if (!evaluation) return null;

  const rawSessions = evaluation.sessions || [];
  const sessionAttrs = rawSessions.map((s) => ({
    name: s.title || s.sessionId || 'Session',
    summary: s.summary || '',
    rating: s.rating || 'Beginning',
    evidence: s.evidence || [],
    calculation: calculateAttributeScore(s, 'Beginning', difficulty),
  }));

  const sessionScore = sessionAttrs.length > 0
    ? sessionAttrs.reduce((sum, s) => sum + s.calculation.supportedScore, 0) / sessionAttrs.length
    : 0;

  const sessionEvidence = sessionAttrs.reduce(
    (acc, s) => {
      const st = s.calculation.evidenceStats;
      return { count: acc.count + st.count, positiveSupport: acc.positiveSupport + st.positiveSupport, negativeSupport: acc.negativeSupport + st.negativeSupport };
    },
    { count: 0, positiveSupport: 0, negativeSupport: 0 },
  );
  sessionEvidence.netSupport = Math.max(0, sessionEvidence.positiveSupport - sessionEvidence.negativeSupport);

  const sessions = {
    score: sessionScore,
    displayedLevel: scoreToRatingLevel(sessionScore),
    summary: `${rawSessions.length} interview session${rawSessions.length !== 1 ? 's' : ''} evaluated`,
    attributes: sessionAttrs,
    evidenceStats: sessionEvidence,
  };

  const competency = calculateDimensionScore(evaluation.competency, difficulty);
  const disposition = calculateDimensionScore(evaluation.disposition, difficulty);
  const characterScore = (competency.score + disposition.score) / 2;
  const processMultiplier = 0.5 + 0.5 * (characterScore / 100);
  const rawScore = sessionScore * processMultiplier;

  return { rawScore, score: Math.round(rawScore), level: scoreToRatingLevel(rawScore), sessions, competency, disposition, characterScore, processMultiplier };
}

function TintedSummaryStat({ label, value, subvalue }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-bold text-gray-900">{value}</div>
      {subvalue && <div className="text-xs text-gray-500">{subvalue}</div>}
    </div>
  );
}

function SessionsStat({ sessions }) {
  const tone = getRatingTone(sessions.displayedLevel);
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Sessions</div>
      <div className={`mt-2 rounded-md border px-2 py-2 text-center ${tone.chip}`}>
        <div className="text-[10px] font-semibold uppercase tracking-wide opacity-80">Sessions</div>
        <div className="text-lg font-bold">{formatWholeNumber(sessions.score)}</div>
      </div>
      <div className="mt-2 text-xs text-gray-500">{sessions.displayedLevel}</div>
    </div>
  );
}

function CharacterStat({ competency, disposition, characterScore, processMultiplier }) {
  const competencyTone = getRatingTone(competency.displayedLevel);
  const dispositionTone = getRatingTone(disposition.displayedLevel);
  const characterTone = getRatingTone(scoreToRatingLevel(characterScore));

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Character</div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className={`min-w-0 flex-1 rounded-md border px-2 py-2 text-center ${competencyTone.chip}`}>
          <div className="text-[10px] font-semibold uppercase tracking-wide opacity-80">Competency</div>
          <div className="text-lg font-bold">{formatWholeNumber(competency.score)}</div>
        </div>
        <div className="shrink-0 text-base font-semibold text-gray-300">+</div>
        <div className={`min-w-0 flex-1 rounded-md border px-2 py-2 text-center ${dispositionTone.chip}`}>
          <div className="text-[10px] font-semibold uppercase tracking-wide opacity-80">Disposition</div>
          <div className="text-lg font-bold">{formatWholeNumber(disposition.score)}</div>
        </div>
        <div className="shrink-0 text-base font-semibold text-gray-300">=</div>
        <div className={`min-w-0 flex-1 rounded-md border px-2 py-2 text-center ${characterTone.chip}`}>
          <div className="text-[10px] font-semibold uppercase tracking-wide opacity-80">Character</div>
          <div className="text-lg font-bold">{formatWholeNumber(characterScore)}</div>
        </div>
      </div>
      <div className="mt-2 text-xs text-gray-500">{formatWholeNumber(processMultiplier * 100)}% Session multiplier</div>
    </div>
  );
}

export default function InterviewEvaluation({ evaluation, difficulty = 3 }) {
  if (!evaluation) return null;

  const result = computeInterviewScore(evaluation, difficulty);
  if (!result) return null;

  const { sessions, competency, disposition, characterScore, processMultiplier, rawScore, level } = result;
  const concerns = evaluation.concerns || [];
  const overallTone = getRatingTone(level);

  const totalEvidence = sessions.evidenceStats.count + competency.evidenceStats.count + disposition.evidenceStats.count;
  const totalPositive = sessions.evidenceStats.positiveSupport + competency.evidenceStats.positiveSupport + disposition.evidenceStats.positiveSupport;
  const totalNegative = sessions.evidenceStats.negativeSupport + competency.evidenceStats.negativeSupport + disposition.evidenceStats.negativeSupport;
  const totalNet = Math.max(0, totalPositive - totalNegative);

  return (
    <div className="not-prose space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Evaluation Snapshot</div>
            <div className="mt-1 flex items-center gap-3">
              <div className="text-2xl font-bold text-gray-900">{formatWholeNumber(rawScore)} / 100</div>
              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${overallTone.chip}`}>{level}</span>
              <span className="rounded-full border border-gray-300 bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">Difficulty {difficulty}</span>
            </div>
            <div className="mt-2 text-sm text-gray-600">Sessions are the main driver of the score. Character reflects Competency and Disposition, and determines how much of the session score counts.</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <TintedSummaryStat
            label="Evidence"
            value={`${totalEvidence} items`}
            subvalue={`Net support +${formatWholeNumber(totalNet)}${totalNegative > 0 ? ` from +${totalPositive} / -${totalNegative}` : ''}${concerns.length > 0 ? ` · ${concerns.length} concern${concerns.length === 1 ? '' : 's'}` : ''}`}
          />
          <SessionsStat sessions={sessions} />
          <div className="md:col-span-2">
            <CharacterStat competency={competency} disposition={disposition} characterScore={characterScore} processMultiplier={processMultiplier} />
          </div>
        </div>
      </div>

      {concerns.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-red-800">
            <AlertTriangle size={16} />
            Global Concerns
          </div>
          <div className="space-y-2">
            {concerns.map((c, i) => {
              const s = CONCERN_STYLES[c.severity] || CONCERN_STYLES.Minor;
              return (
                <div key={i} className={`rounded-lg border px-3 py-2 ${s.row}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800">{c.name}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${s.badge}`}>{c.severity}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-700">{c.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <DimensionCard label="Sessions" dimension={sessions} defaultOpen />
        <DimensionCard label="Competency" dimension={competency} />
        <DimensionCard label="Disposition" dimension={disposition} />
      </div>
    </div>
  );
}
