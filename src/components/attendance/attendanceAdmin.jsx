import React from 'react';
import AttendanceCodeOverlay from './attendanceCodeOverlay.jsx';
import AttendanceSessionList from './attendanceSessionList.jsx';
import CourseAttendanceChart from './courseAttendanceChart.jsx';
import { DEFAULT_ATTENDANCE_QUESTION } from './attendanceUtils.js';

// Instructor (root/editor/mentor) Attendance view: take attendance, or review past sessions.
export default function AttendanceAdmin({ courseOps, course }) {
  const [openSession, setOpenSession] = React.useState(null);
  const [summary, setSummary] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [opening, setOpening] = React.useState(false);

  async function loadSummary() {
    try {
      setSummary(await courseOps.getAttendanceSessions(course.id));
    } catch (ex) {
      setError(ex.message);
    }
  }

  React.useEffect(() => {
    let cancelled = false;
    setError(null);
    // Restore the overlay if attendance is still open (e.g. after a page reload).
    courseOps
      .getOpenAttendance(course.id)
      .then((session) => {
        if (!cancelled) setOpenSession(session || null);
      })
      .catch((ex) => {
        if (!cancelled) setError(ex.message);
      });
    loadSummary();
    return () => {
      cancelled = true;
    };
  }, [course.id]);

  async function takeAttendance() {
    setOpening(true);
    setError(null);
    try {
      // The standard wellness question is always asked so every session's results
      // can be charted consistently over time.
      setOpenSession(await courseOps.openAttendance(course.id, [DEFAULT_ATTENDANCE_QUESTION]));
    } catch (ex) {
      setError(ex.message);
    } finally {
      setOpening(false);
    }
  }

  async function closeAttendance() {
    try {
      await courseOps.closeAttendance(openSession.id);
      setOpenSession(null);
    } catch (ex) {
      setError(ex.message);
    }
    await loadSummary();
  }

  return (
    <div className="relative h-full w-full overflow-auto">
      {openSession && <AttendanceCodeOverlay courseOps={courseOps} session={openSession} onClose={closeAttendance} />}
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="rounded-md border border-gray-200 bg-white p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-base font-semibold text-gray-800">Take attendance</div>
            <button type="button" onClick={takeAttendance} disabled={opening} className="px-4 py-2 rounded-md text-white font-semibold text-sm bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300">
              {opening ? 'Opening...' : 'Take attendance'}
            </button>
          </div>
          <div className="text-sm text-gray-600">
            Learners are asked <span className="font-medium text-gray-700">“{DEFAULT_ATTENDANCE_QUESTION.prompt}”</span> when they check in.
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>

        <div className="rounded-md border border-gray-200 bg-white p-4">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Attendance over time</div>
          {summary ? <CourseAttendanceChart courseOps={courseOps} courseId={course.id} sessions={summary.sessions} /> : <div className="text-sm text-gray-500">Loading attendance...</div>}
        </div>

        {summary && <AttendanceSessionList courseOps={courseOps} courseId={course.id} sessions={summary.sessions} />}
      </div>
    </div>
  );
}
