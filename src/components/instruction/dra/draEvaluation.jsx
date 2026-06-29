import React from 'react';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';

const CONFIDENCE_LEVELS = ['Beginning', 'Emerging', 'Developing', 'Proficient', 'Exemplary'];

const CONCERN_PENALTIES = { Minor: 0.5, Moderate: 1, Major: 2 };
const CONCERN_STYLES = {
  Minor: { badge: 'bg-yellow-100 text-yellow-800 border-yellow-300', row: 'border-yellow-200 bg-yellow-50' },
  Moderate: { badge: 'bg-orange-100 text-orange-800 border-orange-300', row: 'border-orange-200 bg-orange-50' },
  Major: { badge: 'bg-red-100 text-red-800 border-red-300', row: 'border-red-200 bg-red-50' },
};

export function confidenceToScore(level) {
  const idx = CONFIDENCE_LEVELS.indexOf(level);
  return idx >= 0 ? idx + 1 : 0;
}

function confidenceToPoints(level) {
  return Math.max(0, confidenceToScore(level) - 1);
}

function averageConfidencePoints(items, fallbackConfidence) {
  const points = (items || [])
    .map((item) => confidenceToPoints(item?.confidence))
    .filter((score) => Number.isFinite(score));

  if (points.length === 0) {
    return confidenceToPoints(fallbackConfidence);
  }

  return points.reduce((sum, score) => sum + score, 0) / points.length;
}

function pointsToConfidenceLevel(points) {
  const rounded = Math.max(0, Math.min(CONFIDENCE_LEVELS.length - 1, Math.round(points)));
  return CONFIDENCE_LEVELS[rounded];
}

const DIMENSIONS = [
  ['process', 'Process'],
  ['competency', 'Competency'],
  ['disposition', 'Disposition'],
];

function normalizeEvidenceItem(item) {
  if (typeof item === 'string') {
    return { detail: item, weight: 3 };
  }
  if (!item || typeof item !== 'object') {
    return { detail: '', weight: 0 };
  }

  const detail = typeof item.detail === 'string' ? item.detail : typeof item.text === 'string' ? item.text : '';
  const rawWeight = Number(item.weight);
  const weight = Number.isFinite(rawWeight) ? Math.max(1, Math.min(5, Math.round(rawWeight))) : 3;
  return { detail, weight };
}

function getEvidenceStats(items) {
  const normalized = (items || [])
    .map(normalizeEvidenceItem)
    .filter((item) => item.detail);

  const totalWeight = normalized.reduce((sum, item) => sum + item.weight, 0);
  const averageWeight = normalized.length > 0 ? totalWeight / normalized.length : 0;
  return {
    items: normalized,
    count: normalized.length,
    totalWeight,
    averageWeight,
  };
}

function evidenceSupportFactor(items) {
  const stats = getEvidenceStats(items);
  if (stats.count === 0) return 0.15;

  const countFactor = Math.min(1, stats.count / 3);
  const weightFactor = Math.min(1, stats.totalWeight / 12);
  return Math.min(1, (countFactor * 0.45) + (weightFactor * 0.55));
}

function weightedAttributePoints(attribute, fallbackConfidence) {
  const basePoints = confidenceToPoints(attribute?.confidence || fallbackConfidence);
  return basePoints * evidenceSupportFactor(attribute?.evidence);
}

function weightedDimensionPoints(attributes, fallbackConfidence) {
  if (!Array.isArray(attributes) || attributes.length === 0) {
    return confidenceToPoints(fallbackConfidence) * 0.15;
  }

  const points = attributes
    .map((attribute) => weightedAttributePoints(attribute, fallbackConfidence))
    .filter((score) => Number.isFinite(score));

  if (points.length === 0) {
    return confidenceToPoints(fallbackConfidence) * 0.15;
  }

  return points.reduce((sum, score) => sum + score, 0) / points.length;
}

function getDimensionEvidenceStats(dimension) {
  return (dimension?.attributes || []).reduce((acc, attribute) => {
    const stats = getEvidenceStats(attribute?.evidence);
    acc.count += stats.count;
    acc.totalWeight += stats.totalWeight;
    return acc;
  }, { count: 0, totalWeight: 0 });
}

function getConfidenceTone(level) {
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

function StarRating({ level, size = 'text-base' }) {
  const score = confidenceToScore(level);
  return (
    <span className="inline-flex items-center" title={level || 'Beginning'}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={`${size} leading-none ${i < score ? 'text-amber-400' : 'text-gray-300'}`}>★</span>
      ))}
    </span>
  );
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

function AttributeRow({ attr }) {
  const [open, setOpen] = React.useState(false);
  const evidenceStats = getEvidenceStats(attr.evidence);
  const hasEvidence = evidenceStats.count > 0;
  const tone = getConfidenceTone(attr.confidence);

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
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone.chip}`}>{attr.confidence || 'Beginning'}</span>
            </div>
          </div>
        </div>
      </button>
      {open && hasEvidence && (
        <div className="border-t border-gray-100 px-6 py-2">
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Evidence</div>
            <div className="text-[11px] text-gray-500">Total weight {evidenceStats.totalWeight}</div>
          </div>
          <ul className="list-disc space-y-1 pl-4 text-xs text-gray-600">
            {evidenceStats.items.map((e, i) => (
              <li key={i}>
                <span>{e.detail}</span>
                <span className="ml-2 rounded-full border border-gray-300 bg-gray-50 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">Value {e.weight}/5</span>
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
  const attributes = dimension?.attributes || [];
  const tone = getConfidenceTone(dimension?.confidence);
  const evidenceStats = getDimensionEvidenceStats(dimension);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <button type="button" className="w-full px-4 py-3 text-left" onClick={() => setOpen((value) => !value)}>
        <div className="flex items-start gap-3">
          <div className="pt-0.5 text-gray-500">{open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-bold text-gray-900">{label}</div>
                {dimension?.summary && <div className="mt-0.5 text-xs text-gray-600">{dimension.summary}</div>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone.chip}`}>{dimension?.confidence || 'Beginning'}</span>
                <StarRating level={dimension?.confidence} size="text-sm" />
              </div>
            </div>
            <div className="mt-2 text-[11px] font-medium text-gray-500">
              {open
                ? 'Hide attribute details'
                : `Show ${attributes.length} attribute${attributes.length === 1 ? '' : 's'}, ${evidenceStats.count} evidence item${evidenceStats.count === 1 ? '' : 's'}, weight ${evidenceStats.totalWeight}`}
            </div>
          </div>
        </div>
      </button>
      {open && (
        <div className="border-t border-gray-100 px-4 py-3">
          <div className="space-y-2">
            {attributes.map((attr) => <AttributeRow key={attr.name} attr={attr} />)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DraEvaluation({ evaluation }) {
  if (!evaluation) return null;

  const concerns = evaluation.concerns || [];
  const penalty = concerns.reduce((sum, c) => sum + (CONCERN_PENALTIES[c.severity] || 0), 0);
  const processAveragePoints = weightedDimensionPoints(evaluation.process?.attributes, evaluation.process?.confidence);
  const competencyPoints = weightedDimensionPoints(evaluation.competency?.attributes, evaluation.competency?.confidence);
  const dispositionPoints = weightedDimensionPoints(evaluation.disposition?.attributes, evaluation.disposition?.confidence);
  const cdFactor = ((competencyPoints + dispositionPoints) / 2) / 4;
  const weightedStagePoints = processAveragePoints * cdFactor;
  const totalScore = Math.max(0, (weightedStagePoints * (15 / 4)) - penalty);
  const maxScore = 15;
  const overallLevel = pointsToConfidenceLevel(weightedStagePoints);
  const overallTone = getConfidenceTone(overallLevel);
  const totalEvidence = DIMENSIONS.reduce((sum, [key]) => sum + getDimensionEvidenceStats(evaluation[key]).count, 0);
  const totalEvidenceWeight = DIMENSIONS.reduce((sum, [key]) => sum + getDimensionEvidenceStats(evaluation[key]).totalWeight, 0);

  return (
    <div className="not-prose space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Evaluation Snapshot</div>
            <div className="mt-1 flex items-center gap-3">
              <div className="text-2xl font-bold text-gray-900">{Math.round(totalScore * 10) / 10} / {maxScore}</div>
              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${overallTone.chip}`}>{overallLevel}</span>
            </div>
            <div className="mt-2 text-sm text-gray-600">Open a dimension card below to see the attribute breakdown and evidence behind the evaluation.</div>
          </div>
          <div className="min-w-[180px] flex items-center gap-2">
            <StarRating level={overallLevel} />
            {penalty > 0 && <span className="text-xs font-semibold text-red-600">Includes −{penalty} penalty</span>}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <SummaryStat label="Process" value={evaluation.process?.confidence || 'Beginning'} />
          <SummaryStat label="Competency" value={evaluation.competency?.confidence || 'Beginning'} />
          <SummaryStat label="Disposition" value={evaluation.disposition?.confidence || 'Beginning'} />
          <SummaryStat label="Evidence" value={String(totalEvidence)} subvalue={`Weight ${totalEvidenceWeight}${concerns.length > 0 ? ` · ${concerns.length} concern${concerns.length === 1 ? '' : 's'}` : ''}`} />
        </div>
      </div>

      {concerns.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-red-800">
            <AlertTriangle size={16} />
            Concerns
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
        {DIMENSIONS.map(([key, label], index) => (
          <DimensionCard key={key} label={label} dimension={evaluation[key]} defaultOpen={index === 0} />
        ))}
      </div>
    </div>
  );
}
