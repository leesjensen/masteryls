import React from 'react';

// Formats a score/points pair as "18 / 20", with "-" for an unknown score.
function formatScore(score, pointsPossible) {
  const scoreText = typeof score === 'number' ? String(score) : '-';
  const pointsText = typeof pointsPossible === 'number' ? String(pointsPossible) : '-';
  return `${scoreText} / ${pointsText}`;
}

// A learner's current Canvas grades: the overall course grade plus a per-assignment breakdown.
// Read-only; the data is loaded by the MasteryView drill-down via the canvasgradebook `grades` mode.
export default function CanvasGradesPanel({ loading = false, error = null, found = false, overall = null, assignments = [] }) {
  if (loading) return <div className="text-sm text-gray-500 py-4 text-center">Loading Canvas grades...</div>;
  if (error) return <div className="text-sm text-red-600 py-4 text-center">Unable to load Canvas grades: {error}</div>;
  if (!found) return <div className="text-sm text-gray-500 py-4 text-center">This learner was not found in the linked Canvas course.</div>;

  const overallScore = typeof overall?.score === 'number' ? `${overall.score}%` : null;
  const overallGrade = overall?.grade || null;

  return (
    <div data-testid="canvas-grades-panel">
      <div className="text-sm text-gray-700 mb-2">
        Overall:{' '}
        {overallScore || overallGrade ? (
          <strong>
            {overallScore}
            {overallScore && overallGrade ? ' ' : ''}
            {overallGrade ? `(${overallGrade})` : ''}
          </strong>
        ) : (
          <span className="text-gray-400">not available</span>
        )}
      </div>
      {assignments.length === 0 ? (
        <div className="text-sm text-gray-500 py-4 text-center">No Canvas assignments for this learner.</div>
      ) : (
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Assignment</th>
                <th className="text-right px-3 py-2 font-semibold whitespace-nowrap">Score</th>
                <th className="text-right px-3 py-2 font-semibold">Grade</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((assignment, index) => (
                <tr key={`${assignment.name}-${index}`} className="border-t border-gray-100">
                  <td className="px-3 py-2">{assignment.name}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{formatScore(assignment.score, assignment.pointsPossible)}</td>
                  <td className="px-3 py-2 text-right">{assignment.grade ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
