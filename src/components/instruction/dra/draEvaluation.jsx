import React from 'react';
import { Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js';
import { Radar } from 'react-chartjs-2';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const CONFIDENCE_LEVELS = ['Beginning', 'Emerging', 'Developing', 'Proficient', 'Exemplary'];

const CONCERN_PENALTIES = { Minor: 0.5, Moderate: 1, Major: 2 };
const CONCERN_STYLES = {
  Minor:    { badge: 'bg-yellow-100 text-yellow-800 border-yellow-300', row: 'border-yellow-200 bg-yellow-50' },
  Moderate: { badge: 'bg-orange-100 text-orange-800 border-orange-300', row: 'border-orange-200 bg-orange-50' },
  Major:    { badge: 'bg-red-100 text-red-800 border-red-300',          row: 'border-red-200 bg-red-50' },
};

export function confidenceToScore(level) {
  const idx = CONFIDENCE_LEVELS.indexOf(level);
  return idx >= 0 ? idx + 1 : 0;
}

const DIMENSIONS = [
  ['process', 'Process'],
  ['competency', 'Competency'],
  ['disposition', 'Disposition'],
];

function StarRating({ level }) {
  const score = confidenceToScore(level);
  return (
    <span className="inline-flex items-center" title={level || 'Beginning'}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={`text-base leading-none ${i < score ? 'text-amber-400' : 'text-gray-300'}`}>★</span>
      ))}
    </span>
  );
}

function DimensionTable({ dimension }) {
  const [expanded, setExpanded] = React.useState('');
  const attributes = dimension?.attributes || [];

  return (
    <div className="space-y-1">
      {attributes.map((attr) => {
        const isOpen = expanded === attr.name;
        const hasEvidence = (attr.evidence || []).length > 0;
        return (
          <div key={attr.name} className="border border-gray-200 rounded">
            <button type="button" className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left" onClick={() => setExpanded(isOpen ? '' : attr.name)} disabled={!hasEvidence}>
              <span className="min-w-0">
                <span className="font-semibold text-sm text-gray-800">{attr.name}</span>
                {attr.summary && <span className="block text-xs text-gray-500 truncate">{attr.summary}</span>}
              </span>
              <StarRating level={attr.confidence} />
            </button>
            {isOpen && hasEvidence && (
              <ul className="border-t border-gray-100 px-5 py-2 list-disc text-xs text-gray-600 space-y-1">
                {attr.evidence.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Visualizes the AI observation engine's evaluation: a radar over the three primary
// dimensions plus per-dimension attribute tables with confidence and drill-down evidence.
export default function DraEvaluation({ evaluation }) {
  if (!evaluation) {
    return null;
  }

  const data = {
    labels: DIMENSIONS.map(([, label]) => label),
    datasets: [
      {
        label: 'Confidence',
        data: DIMENSIONS.map(([key]) => confidenceToScore(evaluation[key]?.confidence)),
        backgroundColor: 'rgba(37, 99, 235, 0.2)',
        borderColor: 'rgba(37, 99, 235, 0.8)',
        pointBackgroundColor: 'rgba(37, 99, 235, 1)',
      },
    ],
  };

  const options = {
    scales: {
      r: {
        min: 0,
        max: 5,
        ticks: { stepSize: 1, callback: (v) => CONFIDENCE_LEVELS[v - 1] || '', font: { size: 10 }, backdropColor: 'rgba(255,255,255,0.85)', backdropPadding: 2 },
        pointLabels: { font: { size: 16, weight: 'bold' } },
      },
    },
    plugins: { legend: { display: false } },
  };

  const concerns = evaluation.concerns || [];
  const penalty = concerns.reduce((sum, c) => sum + (CONCERN_PENALTIES[c.severity] || 0), 0);
  const rawScore = DIMENSIONS.reduce((sum, [key]) => sum + confidenceToScore(evaluation[key]?.confidence), 0);
  const maxScore = DIMENSIONS.length * 5;
  const totalScore = Math.max(0, rawScore - penalty);

  return (
    <div>
      <div className="not-prose">
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-sm font-bold text-gray-700">Overall Score</span>
          <div className="flex items-center gap-3">
            {penalty > 0 && (
              <span className="text-xs text-red-600 tabular-nums">−{penalty} penalty</span>
            )}
            <StarRating level={CONFIDENCE_LEVELS[Math.round(totalScore / DIMENSIONS.length) - 1]} />
            <span className="text-sm font-semibold text-gray-600 tabular-nums">{totalScore} / {maxScore}</span>
          </div>
        </div>
        <div className="max-w-md mx-auto">
          <Radar data={data} options={options} />
        </div>

        {concerns.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-bold text-red-700 mb-2">Concerns</h3>
            <div className="space-y-2">
              {concerns.map((c, i) => {
                const s = CONCERN_STYLES[c.severity] || CONCERN_STYLES.Minor;
                return (
                  <div key={i} className={`border rounded px-3 py-2 ${s.row}`}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-gray-800">{c.name}</span>
                      <span className={`text-xs font-semibold border rounded px-1.5 py-0.5 ${s.badge}`}>{c.severity}</span>
                    </div>
                    <p className="text-xs text-gray-700">{c.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-4">
          {DIMENSIONS.map(([key, label]) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-bold text-gray-800">{label}</h3>
                <StarRating level={evaluation[key]?.confidence} />
              </div>
              {evaluation[key]?.summary && <p className="text-xs text-gray-600 mb-2">{evaluation[key].summary}</p>}
              <DimensionTable dimension={evaluation[key]} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
