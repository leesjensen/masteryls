import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { computeDraScore, scoreToRatingLevel } from './draScore';
import { getRatingTone, formatWholeNumber, DimensionCard } from '../../shared/EvaluationDimension';

const CONCERN_STYLES = {
  Minor: { badge: 'bg-yellow-100 text-yellow-800 border-yellow-300', row: 'border-yellow-200 bg-yellow-50' },
  Moderate: { badge: 'bg-orange-100 text-orange-800 border-orange-300', row: 'border-orange-200 bg-orange-50' },
  Major: { badge: 'bg-red-100 text-red-800 border-red-300', row: 'border-red-200 bg-red-50' },
};

function SummaryStat({ label, value, subvalue, tone = 'text-gray-900' }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`mt-1 text-lg font-bold ${tone}`}>{value}</div>
      {subvalue && <div className="text-xs text-gray-500">{subvalue}</div>}
    </div>
  );
}

function ProcessStat({ process }) {
  const processTone = getRatingTone(process.displayedLevel);

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Process</div>
      <div className={`mt-2 rounded-md border px-2 py-2 text-center ${processTone.chip}`}>
        <div className="text-[10px] font-semibold uppercase tracking-wide opacity-80">Process</div>
        <div className="text-lg font-bold">{formatWholeNumber(process.score)}</div>
      </div>
      <div className="mt-2 text-xs text-gray-500">{process.displayedLevel}</div>
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
      <div className="mt-2 text-xs text-gray-500">{formatWholeNumber(processMultiplier * 100)}% Process multiplier</div>
    </div>
  );
}

function statAccentClasses(variant) {
  switch (variant) {
    case 'process':
      return 'border-sky-200 bg-sky-50';
    case 'character':
      return 'border-sky-200 bg-sky-50';
    case 'evidence':
      return 'border-gray-200 bg-gray-50';
    default:
      return 'border-gray-200 bg-white';
  }
}

function TintedSummaryStat({ label, value, subvalue, tone = 'text-gray-900', variant }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${statAccentClasses(variant)}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`mt-1 text-lg font-bold ${tone}`}>{value}</div>
      {subvalue && <div className="text-xs text-gray-500">{subvalue}</div>}
    </div>
  );
}

export default function DraEvaluation({ evaluation, difficulty = 3 }) {
  if (!evaluation) return null;

  const concerns = evaluation.concerns || [];
  const { process, competency, disposition, characterScore, processMultiplier, rawScore: rawFinalScore, level: overallLevelFromTotal } = computeDraScore(evaluation, difficulty);
  const overallTone = getRatingTone(overallLevelFromTotal);
  const totalEvidence = [process, competency, disposition].reduce((sum, dimension) => sum + dimension.evidenceStats.count, 0);
  const totalPositiveSupport = [process, competency, disposition].reduce((sum, dimension) => sum + dimension.evidenceStats.positiveSupport, 0);
  const totalNegativeSupport = [process, competency, disposition].reduce((sum, dimension) => sum + dimension.evidenceStats.negativeSupport, 0);
  const totalNetSupport = Math.max(0, totalPositiveSupport - totalNegativeSupport);

  return (
    <div className="not-prose space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Evaluation Snapshot</div>
            <div className="mt-1 flex items-center gap-3">
              <div className="text-2xl font-bold text-gray-900">{formatWholeNumber(rawFinalScore)} / 100</div>
              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${overallTone.chip}`}>{overallLevelFromTotal}</span>
              <span className="rounded-full border border-gray-300 bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">Difficulty {difficulty}</span>
            </div>
            <div className="mt-2 text-sm text-gray-600">Process is the main driver of the score. Character reflects Competency and Disposition, and determines how much of the Process score counts.</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <TintedSummaryStat
            label="Evidence"
            value={`${totalEvidence} items`}
            subvalue={`Net support +${formatWholeNumber(totalNetSupport)}${totalNegativeSupport > 0 ? ` from +${totalPositiveSupport} / -${totalNegativeSupport}` : ''}${concerns.length > 0 ? ` · ${concerns.length} concern${concerns.length === 1 ? '' : 's'}` : ''}`}
            variant="evidence"
          />
          <ProcessStat process={process} />
          <div className="md:col-span-2">
            <CharacterStat
              competency={competency}
              disposition={disposition}
              characterScore={characterScore}
              processMultiplier={processMultiplier}
            />
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
        <DimensionCard key="process" label="Process" dimension={process} defaultOpen />
        <DimensionCard key="competency" label="Competency" dimension={competency} />
        <DimensionCard key="disposition" label="Disposition" dimension={disposition} />
      </div>
    </div>
  );
}
