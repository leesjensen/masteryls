import React from 'react';
import { tallyAttendanceAnswers } from './attendanceUtils.js';

// Who checked in to a session and how they answered its questions.
export default function AttendanceResponses({ courseOps, courseId, session }) {
  const [responses, setResponses] = React.useState(null);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    let cancelled = false;
    courseOps
      .getAttendanceResponses(courseId, session.id)
      .then((rows) => {
        if (!cancelled) setResponses(rows.sort((a, b) => (a.user?.name || '').localeCompare(b.user?.name || '')));
      })
      .catch((ex) => {
        if (!cancelled) setError(ex.message);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId, session.id]);

  if (error) return <div className="text-sm text-red-600">Unable to load responses: {error}</div>;
  if (!responses) return <div className="text-sm text-gray-500">Loading responses...</div>;
  if (responses.length === 0) return <div className="text-sm text-gray-500">No one checked in to this class.</div>;

  const questions = session.questions || [];
  const tally = tallyAttendanceAnswers(questions, responses);

  return (
    <div className="space-y-3" data-testid="attendance-responses">
      {questions.map((question) => {
        const counts = tally[question.id] || {};
        const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
        return (
          <div key={question.id} className="max-w-md">
            <div className="text-sm font-medium text-gray-700 mb-1">{question.prompt}</div>
            {Object.entries(counts).map(([choice, count]) => {
              const percent = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={choice} className="text-xs mb-1">
                  <div className="flex justify-between text-gray-600">
                    <span>{choice}</span>
                    <span>
                      {count} ({percent}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div className="bg-amber-400 h-full" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-gray-700">
          <tr>
            <th className="text-left px-3 py-1 font-semibold">Learner</th>
            <th className="text-left px-3 py-1 font-semibold">Checked in</th>
            {questions.map((question) => (
              <th key={question.id} className="text-left px-3 py-1 font-semibold">
                {question.prompt}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {responses.map((response) => (
            <tr key={response.id} className="border-t border-gray-100">
              <td className="px-3 py-1 text-gray-800">{response.user?.name || response.user?.email || response.userId}</td>
              <td className="px-3 py-1 text-gray-600">
                {new Date(response.createdAt).toLocaleTimeString(undefined, {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </td>
              {questions.map((question) => (
                <td key={question.id} className="px-3 py-1 text-gray-600">
                  {response.details?.answers?.[question.id] || '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
