import React from 'react';
import BarChartSvg from '../charts/barChartSvg.jsx';
import { buildAttendanceHistory, sentimentColor, ATTENDANCE_SENTIMENTS, NO_RESPONSE_COLOR } from './attendanceUtils.js';
import { getAttendanceGradeSettings, calculateAttendancePoints } from '../../hooks/canvas/attendanceCanvasSync.js';

const PRESENT_COLOR = '#10b981';
const ABSENT_COLOR = '#e5e7eb';

// A learner's attendance across every session held in the course. Used by the learner's
// Attendance view and the MasteryView learner drill-down. Change refreshKey to reload.
// presentOnly charts just the sessions the learner attended (the learner-facing view
// hides absences); the overseer drill-down leaves it off so absences stay visible.
export default function AttendanceHistory({ courseOps, course, userId, refreshKey = 0, presentOnly = false }) {
  const [history, setHistory] = React.useState(null);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    if (!course?.id || !userId) return undefined;
    let cancelled = false;
    setError(null);
    Promise.all([courseOps.getAttendanceSessions(course.id), courseOps.getLearnerAttendance(course.id, userId)])
      .then(([{ sessions }, rows]) => {
        if (!cancelled) setHistory(buildAttendanceHistory(sessions, rows));
      })
      .catch((ex) => {
        if (!cancelled) setError(ex.message);
      });
    return () => {
      cancelled = true;
    };
  }, [course?.id, userId, refreshKey]);

  if (error) return <div className="text-sm text-red-600">Unable to load attendance: {error}</div>;
  if (!history) return <div className="text-sm text-gray-500 py-4 text-center">Loading attendance...</div>;
  if (history.length === 0) return <div className="text-sm text-gray-500 py-4 text-center">No attendance has been taken yet.</div>;

  const attended = history.filter((entry) => entry.present).length;
  const gradeSettings = getAttendanceGradeSettings(course);
  const chartEntries = presentOnly ? history.filter((entry) => entry.present) : history;

  // In the learner's own view each attended bar is coloured by their answer to that
  // session's wellness question; the overseer drill-down keeps the present/absent colours.
  const dateGroups = chartEntries.map(({ session, present, answer }) => {
    const label = new Date(session.openedAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
    const color = presentOnly ? sentimentColor(answer) : present ? PRESENT_COLOR : ABSENT_COLOR;
    const titleState = presentOnly ? answer || 'No response' : present ? 'Present' : 'Absent';
    return {
      day: session.id,
      ts: new Date(session.openedAt).getTime(),
      count: 1,
      color,
      title: `${label}: ${titleState}`,
    };
  });

  // Legend reflects the answers the learner actually gave (ordered best -> worst),
  // plus "No response" when any attended session had no answer (e.g. legacy sessions).
  const usedAnswers = new Set(chartEntries.map((entry) => entry.answer).filter(Boolean));
  const hasNoResponse = chartEntries.some((entry) => !entry.answer);
  const sentimentLegend = [...ATTENDANCE_SENTIMENTS.filter((sentiment) => usedAnswers.has(sentiment.value)), ...(hasNoResponse ? [{ value: 'No response', color: NO_RESPONSE_COLOR }] : [])];

  return (
    <div data-testid="attendance-history">
      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-700 mb-2">
        <span>
          {presentOnly ? (
            <>
              Attended <strong>{attended}</strong> class{attended !== 1 ? 'es' : ''}
            </>
          ) : (
            <>
              Attended <strong>{attended}</strong> of <strong>{history.length}</strong> classes
            </>
          )}
        </span>
        {gradeSettings && (
          <span>
            Points: <strong>{calculateAttendancePoints(attended, gradeSettings)}</strong> / {gradeSettings.pointsPossible}
          </span>
        )}
        {!presentOnly && (
          <span className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: PRESENT_COLOR }} /> Present
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: ABSENT_COLOR }} /> Absent
            </span>
          </span>
        )}
        {presentOnly && sentimentLegend.length > 0 && (
          <span className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
            {sentimentLegend.map((item) => (
              <span key={item.value} className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm" style={{ background: item.color }} /> {item.value}
              </span>
            ))}
          </span>
        )}
      </div>
      {dateGroups.length > 0 ? (
        <BarChartSvg dateGroups={dateGroups} maxValue={1} yTicks={[]} yLabel="" ariaLabel="Attendance history chart" showTime />
      ) : (
        <div className="text-sm text-gray-500 py-4 text-center">No classes attended yet.</div>
      )}
    </div>
  );
}
