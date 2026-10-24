import React from 'react';
import BarChartSvg from '../charts/barChartSvg.jsx';
import SentimentLegend from './sentimentLegend.jsx';
import { buildAttendanceHistory, sentimentColor, ATTENDANCE_SENTIMENTS, NO_RESPONSE_COLOR } from './attendanceUtils.js';
import { getAttendanceGradeSettings, calculateAttendancePoints } from '../../hooks/canvas/attendanceCanvasSync.js';

// One learner's attended classes, each bar coloured by their answer to that session's
// wellness question ("How are things going?"). When a sectionId is given (attendance is now taken
// per section), the chart scopes to that section's sessions and can show an honest "attended N of M".
// Without one it falls back to the attended-only view (no total). Used by the learner's own Attendance
// page and the MasteryView learner drill-down. Change refreshKey to reload.
export default function LearnerAttendanceChart({ courseOps, course, userId, sectionId = null, refreshKey = 0 }) {
  const [history, setHistory] = React.useState(null);
  const [totalSessions, setTotalSessions] = React.useState(0);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    if (!course?.id || !userId) return undefined;
    let cancelled = false;
    setError(null);
    Promise.all([courseOps.getAttendanceSessions(course.id, sectionId || null), courseOps.getLearnerAttendance(course.id, userId)])
      .then(([{ sessions }, rows]) => {
        if (!cancelled) {
          setHistory(buildAttendanceHistory(sessions, rows));
          setTotalSessions(Array.isArray(sessions) ? sessions.length : 0);
        }
      })
      .catch((ex) => {
        if (!cancelled) setError(ex.message);
      });
    return () => {
      cancelled = true;
    };
  }, [course?.id, userId, sectionId, refreshKey]);

  if (error) return <div className="text-sm text-red-600">Unable to load attendance: {error}</div>;
  if (!history) return <div className="text-sm text-gray-500 py-4 text-center">Loading attendance...</div>;
  if (history.length === 0) return <div className="text-sm text-gray-500 py-4 text-center">No attendance has been taken yet.</div>;

  const attendedEntries = history.filter((entry) => entry.present);
  const attended = attendedEntries.length;
  const gradeSettings = getAttendanceGradeSettings(course);

  // Each attended bar is coloured by the learner's answer to that session's wellness question.
  const dateGroups = attendedEntries.map(({ session, answer }) => {
    const label = new Date(session.openedAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
    return {
      day: session.id,
      ts: new Date(session.openedAt).getTime(),
      count: 1,
      color: sentimentColor(answer),
      title: `${label}: ${answer || 'No response'}`,
    };
  });

  // Legend reflects the answers the learner actually gave (ordered best -> worst),
  // plus "No response" when any attended session had no answer (e.g. legacy sessions).
  const usedAnswers = new Set(attendedEntries.map((entry) => entry.answer).filter(Boolean));
  const hasNoResponse = attendedEntries.some((entry) => !entry.answer);
  const sentimentLegend = [...ATTENDANCE_SENTIMENTS.filter((sentiment) => usedAnswers.has(sentiment.value)), ...(hasNoResponse ? [{ value: 'No response', color: NO_RESPONSE_COLOR }] : [])];

  return (
    <div data-testid="learner-attendance-chart">
      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-700 mb-2">
        <span>
          Attended <strong>{attended}</strong>
          {sectionId ? <> of <strong>{totalSessions}</strong></> : null} class{(sectionId ? totalSessions : attended) !== 1 ? 'es' : ''}
        </span>
        {gradeSettings && (
          <span>
            Points: <strong>{calculateAttendancePoints(attended, gradeSettings)}</strong> / {gradeSettings.pointsPossible}
          </span>
        )}
        <SentimentLegend items={sentimentLegend} />
      </div>
      {dateGroups.length > 0 ? (
        <BarChartSvg dateGroups={dateGroups} maxValue={1} yTicks={[]} yLabel="" ariaLabel="Attendance history chart" showTime />
      ) : (
        <div className="text-sm text-gray-500 py-4 text-center">No classes attended yet.</div>
      )}
    </div>
  );
}
