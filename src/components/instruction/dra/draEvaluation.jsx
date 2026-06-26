import React from 'react';
import { Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js';
import { Radar } from 'react-chartjs-2';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const CONFIDENCE_LEVELS = ['Beginning', 'Emerging', 'Developing', 'Proficient', 'Exemplary'];

export function confidenceToScore(level) {
  const idx = CONFIDENCE_LEVELS.indexOf(level);
  return idx >= 0 ? idx + 1 : 0;
}

const DIMENSIONS = [
  ['process', 'Process'],
  ['competency', 'Competency'],
  ['disposition', 'Disposition'],
];

function ConfidenceBadge({ level }) {
  const score = confidenceToScore(level);
  const tone = score >= 4 ? 'bg-green-100 text-green-800 border-green-200' : score === 3 ? 'bg-blue-100 text-blue-800 border-blue-200' : score === 2 ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-gray-100 text-gray-600 border-gray-200';
  return <span className={`inline-block rounded border px-2 py-0.5 text-xs font-semibold ${tone}`}>{level || 'Beginning'}</span>;
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
              <ConfidenceBadge level={attr.confidence} />
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
        ticks: { stepSize: 1, callback: (v) => CONFIDENCE_LEVELS[v - 1] || '' },
        pointLabels: { font: { size: 13 } },
      },
    },
    plugins: { legend: { display: false } },
  };

  return (
    <div className="mt-8">
      <h2>Evaluation</h2>
      <div className="not-prose">
        <div className="max-w-md mx-auto">
          <Radar data={data} options={options} />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4">
          {DIMENSIONS.map(([key, label]) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-bold text-gray-800">{label}</h3>
                <ConfidenceBadge level={evaluation[key]?.confidence} />
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
