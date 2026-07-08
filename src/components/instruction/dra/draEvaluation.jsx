import React from 'react';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';

const RATING_LEVELS = ['Beginning', 'Emerging', 'Developing', 'Proficient', 'Exemplary'];
const RATING_BASE_SCORES = {
  Beginning: 0,
  Emerging: 25,
  Developing: 50,
  Proficient: 75,
  Exemplary: 100,
};
const POSITIVE_SUPPORT_VALUES = { light: 10, moderate: 20, strong: 34 };
const NEGATIVE_SUPPORT_VALUES = { light: 10, moderate: 20, strong: 30 };
const SUPPORT_CAP = 110;
const DIFFICULTY_SUPPORT_MULTIPLIERS = {
  1: 1.75,
  2: 1.4,
  3: 1.0,
  4: 0.85,
  5: 0.7,
};
const CONCERN_STYLES = {
  Minor: { badge: 'bg-yellow-100 text-yellow-800 border-yellow-300', row: 'border-yellow-200 bg-yellow-50' },
  Moderate: { badge: 'bg-orange-100 text-orange-800 border-orange-300', row: 'border-orange-200 bg-orange-50' },
  Major: { badge: 'bg-red-100 text-red-800 border-red-300', row: 'border-red-200 bg-red-50' },
};

const DIMENSIONS = [
  ['process', 'Process'],
  ['competency', 'Competency'],
  ['disposition', 'Disposition'],
];

function getRating(entity, fallback = 'Beginning') {
  if (entity?.rating) return entity.rating;
  return fallback;
}

function ratingToBaseScore(level) {
  return RATING_BASE_SCORES[level] ?? 0;
}

function scoreToRatingLevel(score) {
  if (score >= 80) return 'Exemplary';
  if (score >= 60) return 'Proficient';
  if (score >= 40) return 'Developing';
  if (score >= 20) return 'Emerging';
  return 'Beginning';
}

function normalizeEvidenceItem(item) {
  if (typeof item === 'string') {
    return { detail: item, polarity: 'positive', impact: 'moderate' };
  }
  if (!item || typeof item !== 'object') {
    return { detail: '', polarity: 'positive', impact: 'moderate' };
  }

  const detail = typeof item.detail === 'string' ? item.detail : typeof item.text === 'string' ? item.text : '';
  const polarity = item.polarity === 'negative' ? 'negative' : 'positive';
  const impact = ['light', 'moderate', 'strong'].includes(item.impact) ? item.impact : 'moderate';
  return { detail, polarity, impact };
}

function getEvidenceValue(item) {
  if (item.polarity === 'negative') {
    return -NEGATIVE_SUPPORT_VALUES[item.impact];
  }
  return POSITIVE_SUPPORT_VALUES[item.impact];
}

function getDifficultySupportMultiplier(difficulty) {
  const normalizedDifficulty = Math.max(1, Math.min(5, Math.round(Number(difficulty) || 3)));
  return DIFFICULTY_SUPPORT_MULTIPLIERS[normalizedDifficulty] || DIFFICULTY_SUPPORT_MULTIPLIERS[3];
}

function getEvidenceStats(items, difficulty = 3) {
  const normalized = (items || [])
    .map(normalizeEvidenceItem)
    .filter((item) => item.detail);

  const positiveSupportRaw = normalized
    .filter((item) => item.polarity === 'positive')
    .reduce((sum, item) => sum + getEvidenceValue(item), 0);
  const negativeSupport = normalized
    .filter((item) => item.polarity === 'negative')
    .reduce((sum, item) => sum + Math.abs(getEvidenceValue(item)), 0);

  const positiveSupport = Math.min(SUPPORT_CAP, positiveSupportRaw);
  const netSupport = Math.max(0, positiveSupport - negativeSupport);
  const difficultyMultiplier = getDifficultySupportMultiplier(difficulty);
  const adjustedSupport = Math.max(0, Math.min(100, netSupport * difficultyMultiplier));
  const supportFactor = adjustedSupport / 100;

  return {
    items: normalized,
    count: normalized.length,
    positiveSupport,
    negativeSupport,
    netSupport,
    adjustedSupport,
    supportFactor,
  };
}

function calculateAttributeScore(attribute, fallbackRating, difficulty) {
  const baseScore = ratingToBaseScore(getRating(attribute, fallbackRating));
  const evidenceStats = getEvidenceStats(attribute?.evidence, difficulty);
  const supportedScore = baseScore * (0.5 + (0.5 * evidenceStats.supportFactor));
  return {
    baseScore,
    supportedScore,
    displayedLevel: scoreToRatingLevel(supportedScore),
    evidenceStats,
  };
}

function calculateDimensionScore(dimension, difficulty) {
  const fallbackRating = getRating(dimension);
  const attributes = Array.isArray(dimension?.attributes) ? dimension.attributes : [];

  if (attributes.length === 0) {
    const baseScore = ratingToBaseScore(fallbackRating);
    return {
      summary: dimension?.summary || '',
      score: baseScore,
      displayedLevel: scoreToRatingLevel(baseScore),
      attributes: [],
      evidenceStats: { count: 0, positiveSupport: 0, negativeSupport: 0, netSupport: 0, supportFactor: 0 },
    };
  }

  const scoredAttributes = attributes.map((attribute) => ({
    ...attribute,
    calculation: calculateAttributeScore(attribute, fallbackRating, difficulty),
  }));

  const score = scoredAttributes.reduce((sum, attribute) => sum + attribute.calculation.supportedScore, 0) / scoredAttributes.length;
  const evidenceStats = scoredAttributes.reduce((acc, attribute) => {
    const stats = attribute.calculation.evidenceStats;
    acc.count += stats.count;
    acc.positiveSupport += stats.positiveSupport;
    acc.negativeSupport += stats.negativeSupport;
    return acc;
  }, { count: 0, positiveSupport: 0, negativeSupport: 0 });
  evidenceStats.netSupport = Math.max(0, evidenceStats.positiveSupport - evidenceStats.negativeSupport);
  evidenceStats.adjustedSupport = Math.max(0, Math.min(100, evidenceStats.netSupport * getDifficultySupportMultiplier(difficulty)));
  evidenceStats.supportFactor = evidenceStats.adjustedSupport / 100;

  return {
    summary: dimension?.summary || '',
    score,
    displayedLevel: scoreToRatingLevel(score),
    attributes: scoredAttributes,
    evidenceStats,
  };
}

function getRatingTone(level) {
  switch (level) {
    case 'Exemplary':
      return {
        chip: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        text: 'text-emerald-700',
      };
    case 'Proficient':
      return {
        chip: 'bg-sky-100 text-sky-800 border-sky-300',
        text: 'text-sky-700',
      };
    case 'Developing':
      return {
        chip: 'bg-amber-100 text-amber-800 border-amber-300',
        text: 'text-amber-700',
      };
    case 'Emerging':
      return {
        chip: 'bg-orange-100 text-orange-800 border-orange-300',
        text: 'text-orange-700',
      };
    default:
      return {
        chip: 'bg-gray-100 text-gray-700 border-gray-300',
        text: 'text-gray-700',
      };
  }
}

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

function formatWholeNumber(value) {
  return String(Math.round(value));
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

function EvidenceBadge({ item }) {
  const value = getEvidenceValue(item);
  const label = value >= 0 ? `+${value} ${item.impact}` : `${value} ${item.impact}`;
  const classes = value >= 0
    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
    : 'border-red-300 bg-red-50 text-red-700';

  return <span className={`ml-2 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${classes}`}>{label}</span>;
}

function AttributeRow({ attr }) {
  const [open, setOpen] = React.useState(false);
  const { calculation } = attr;
  const evidenceStats = calculation.evidenceStats;
  const hasEvidence = evidenceStats.count > 0;
  const tone = getRatingTone(calculation.displayedLevel);

  return (
    <div className="rounded-md border border-gray-200 bg-white">
      <button
        type="button"
        className={`w-full px-3 py-2 text-left ${hasEvidence ? 'cursor-pointer' : 'cursor-default'}`}
        onClick={() => hasEvidence && setOpen((value) => !value)}
        disabled={!hasEvidence}
      >
        <div className="flex items-start gap-3">
          <div className="pt-0.5 text-gray-400">{hasEvidence ? (open ? <ChevronDown size={16} /> : <ChevronRight size={16} />) : <div className="w-4" />}</div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-800">{attr.name}</div>
                {attr.summary && <div className="text-xs text-gray-500">{attr.summary}</div>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone.chip}`}>{calculation.displayedLevel}</span>
              </div>
            </div>
            <div className="mt-1 text-[11px] text-gray-500">
              Supported score {formatWholeNumber(calculation.supportedScore)} / 100 with {formatWholeNumber(evidenceStats.netSupport)}% support
            </div>
          </div>
        </div>
      </button>
      {open && hasEvidence && (
        <div className="border-t border-gray-100 px-6 py-2">
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Evidence</div>
            <div className="text-[11px] text-gray-500">
              Support +{evidenceStats.positiveSupport}
              {evidenceStats.negativeSupport > 0 ? ` / Counter -${evidenceStats.negativeSupport}` : ''}
            </div>
          </div>
          <ul className="list-disc space-y-1 pl-4 text-xs text-gray-600">
            {evidenceStats.items.map((item, index) => (
              <li key={index}>
                <span>{item.detail}</span>
                <EvidenceBadge item={item} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function DimensionCard({ label, dimension, defaultOpen = false }) {
  const [open, setOpen] = React.useState(defaultOpen);
  const tone = getRatingTone(dimension.displayedLevel);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <button type="button" className="w-full px-4 py-3 text-left" onClick={() => setOpen((value) => !value)}>
        <div className="flex items-start gap-3">
          <div className="pt-0.5 text-gray-500">{open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-gray-900">{label}</div>
                {dimension?.summary && <div className="mt-0.5 text-xs text-gray-600">{dimension.summary}</div>}
              </div>
              <div className="flex shrink-0 items-start gap-2 pt-0.5">
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone.chip}`}>{dimension.displayedLevel}</span>
              </div>
            </div>
            <div className="mt-2 text-[11px] font-medium text-gray-500">
              {open
                ? 'Hide attribute details'
                : `Show ${dimension.attributes.length} attribute${dimension.attributes.length === 1 ? '' : 's'} and ${dimension.evidenceStats.count} evidence item${dimension.evidenceStats.count === 1 ? '' : 's'}`}
            </div>
          </div>
        </div>
      </button>
      {open && (
        <div className="border-t border-gray-100 px-4 py-3">
          <div className="mb-3 text-xs text-gray-500">
            Score {formatWholeNumber(dimension.score)} / 100 from the supported attribute scores in this dimension.
          </div>
          <div className="space-y-2">
            {dimension.attributes.map((attr) => <AttributeRow key={attr.name} attr={attr} />)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DraEvaluation({ evaluation, difficulty = 3 }) {
  if (!evaluation) return null;

  const concerns = evaluation.concerns || [];
  const process = calculateDimensionScore(evaluation.process, difficulty);
  const competency = calculateDimensionScore(evaluation.competency, difficulty);
  const disposition = calculateDimensionScore(evaluation.disposition, difficulty);
  const characterScore = (competency.score + disposition.score) / 2;
  const characterFactor = characterScore / 100;
  const processMultiplier = 0.5 + (0.5 * characterFactor);
  const rawFinalScore = process.score * processMultiplier;
  const overallLevelFromTotal = scoreToRatingLevel(rawFinalScore);
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
