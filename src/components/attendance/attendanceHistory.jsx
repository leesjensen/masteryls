import React from 'react';
import BarChartSvg from '../charts/barChartSvg.jsx';
import { buildAttendanceHistory } from './attendanceUtils.js';
import { getAttendanceGradeSettings, calculateAttendancePoints } from '../../hooks/canvas/attendanceCanvasSync.js';

const PRESENT_COLOR = '#10b981';
const ABSENT_COLOR = '#e5e7eb';

// A learner's attendance across every session held in the course. Used by the learner's
// Attendance view and the MasteryView learner drill-down. Change refreshKey to reload.
export default function AttendanceHistory({ courseOps, course, userId, refreshKey = 0 }) {
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

  const dateGroups = history.map(({ session, present }) => {
    const label = new Date(session.openedAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
    return {
      day: session.id,
      ts: new Date(session.openedAt).getTime(),
      count: 1,
      color: present ? PRESENT_COLOR : ABSENT_COLOR,
      title: `${label}: ${present ? 'Present' : 'Absent'}`,
    };
  });

  return (
    <div data-testid="attendance-history">
      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-700 mb-2">
        <span>
          Attended <strong>{attended}</strong> of <strong>{history.length}</strong> classes
        </span>
        {gradeSettings && (
          <span>
            Points: <strong>{calculateAttendancePoints(attended, gradeSettings)}</strong> / {gradeSettings.pointsPossible}
          </span>
        )}
        <span className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: PRESENT_COLOR }} /> Present
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: ABSENT_COLOR }} /> Absent
          </span>
        </span>
      </div>
      <BarChartSvg dateGroups={dateGroups} maxValue={1} yTicks={[]} yLabel="" ariaLabel="Attendance history chart" showTime />
    </div>
  );
}
