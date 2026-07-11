import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { getEvidenceValue } from '../instruction/dra/draScore';

export function getRatingTone(level) {
  switch (level) {
    case 'Exemplary':
      return { chip: 'bg-emerald-100 text-emerald-800 border-emerald-300', text: 'text-emerald-700' };
    case 'Proficient':
      return { chip: 'bg-sky-100 text-sky-800 border-sky-300', text: 'text-sky-700' };
    case 'Developing':
      return { chip: 'bg-amber-100 text-amber-800 border-amber-300', text: 'text-amber-700' };
    case 'Emerging':
      return { chip: 'bg-orange-100 text-orange-800 border-orange-300', text: 'text-orange-700' };
    default:
      return { chip: 'bg-gray-100 text-gray-700 border-gray-300', text: 'text-gray-700' };
  }
}

export function formatWholeNumber(value) {
  return String(Math.round(value));
}

function EvidenceBadge({ item }) {
  const value = getEvidenceValue(item);
  const label = value >= 0 ? `+${value} ${item.impact}` : `${value} ${item.impact}`;
  const classes = value >= 0
    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
    : 'border-red-300 bg-red-50 text-red-700';

  return <span className={`ml-2 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${classes}`}>{label}</span>;
}

export function AttributeRow({ attr }) {
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
                <span>{item.detail} <span className="whitespace-nowrap"><EvidenceBadge item={item} /></span></span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function DimensionCard({ label, dimension, defaultOpen = false }) {
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
