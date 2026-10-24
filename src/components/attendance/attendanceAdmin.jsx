import React from 'react';
import AttendanceCodeOverlay from './attendanceCodeOverlay.jsx';
import AttendanceSessionList from './attendanceSessionList.jsx';
import CourseAttendanceChart from './courseAttendanceChart.jsx';
import { DEFAULT_ATTENDANCE_QUESTION } from './attendanceUtils.js';

// Instructor (root/editor/mentor) Attendance view: attendance is taken per SECTION. The instructor
// picks a section, enables attendance for it (so its learners get the check-in affordance), takes
// attendance, and reviews that section's past sessions.
export default function AttendanceAdmin({ courseOps, course }) {
  const [sections, setSections] = React.useState(() => (Array.isArray(course?.sections) ? course.sections : []));
  const [selectedSectionId, setSelectedSectionId] = React.useState(() => (Array.isArray(course?.sections) && course.sections[0] ? course.sections[0].id : ''));
  const [openSession, setOpenSession] = React.useState(null);
  const [summary, setSummary] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [opening, setOpening] = React.useState(false);
  const [savingEnabled, setSavingEnabled] = React.useState(false);

  const selectedSection = sections.find((section) => section.id === selectedSectionId) || null;
  const attendanceEnabled = Boolean(selectedSection?.attendanceEnabled);

  React.useEffect(() => {
    const next = Array.isArray(course?.sections) ? course.sections : [];
    setSections(next);
    setSelectedSectionId((prev) => (next.some((section) => section.id === prev) ? prev : next[0]?.id || ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course?.id]);

  async function loadSummary() {
    if (!selectedSectionId) {
      setSummary(null);
      return;
    }
    try {
      setSummary(await courseOps.getAttendanceSessions(course.id, selectedSectionId));
    } catch (ex) {
      setError(ex.message);
    }
  }

  React.useEffect(() => {
    if (!selectedSectionId) {
      setOpenSession(null);
      setSummary(null);
      return undefined;
    }
    let cancelled = false;
    setError(null);
    // Restore the overlay if a session is still open for this section (e.g. after a reload).
    courseOps
      .getOpenAttendance(course.id, selectedSectionId)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course.id, selectedSectionId]);

  async function takeAttendance() {
    setOpening(true);
    setError(null);
    try {
      // The standard wellness question is always asked so every session's results can be charted.
      setOpenSession(await courseOps.openAttendance(course.id, selectedSectionId, [DEFAULT_ATTENDANCE_QUESTION]));
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

  async function toggleEnabled(enabled) {
    if (!selectedSection) return;
    setSavingEnabled(true);
    setError(null);
    try {
      await courseOps.setSectionAttendanceEnabled(selectedSection.id, enabled);
      setSections((prev) => prev.map((section) => (section.id === selectedSection.id ? { ...section, attendanceEnabled: enabled } : section)));
    } catch (ex) {
      setError(ex.message);
    } finally {
      setSavingEnabled(false);
    }
  }

  if (sections.length === 0) {
    return (
      <div className="relative h-full w-full overflow-auto">
        <div className="max-w-4xl mx-auto p-4">
          <div className="rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-600">Attendance is taken per section. This course has no sections yet — add a schedule/section to enable attendance.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-auto">
      {openSession && <AttendanceCodeOverlay courseOps={courseOps} session={openSession} onClose={closeAttendance} />}
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="rounded-md border border-gray-200 bg-white p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="text-sm text-gray-700 flex items-center gap-2">
              Section
              <select value={selectedSectionId} onChange={(e) => setSelectedSectionId(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm">
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.title || 'Section'}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-gray-700 flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={attendanceEnabled} disabled={savingEnabled} onChange={(e) => toggleEnabled(e.target.checked)} className="cursor-pointer" />
              Attendance enabled for this section
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-gray-600">
              Learners are asked <span className="font-medium text-gray-700">“{DEFAULT_ATTENDANCE_QUESTION.prompt}”</span> when they check in.
            </div>
            <button type="button" onClick={takeAttendance} disabled={opening || !attendanceEnabled} className="px-4 py-2 rounded-md text-white font-semibold text-sm bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300">
              {opening ? 'Opening...' : 'Take attendance'}
            </button>
          </div>
          {!attendanceEnabled && <div className="text-xs text-gray-500">Enable attendance for this section to take attendance.</div>}
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
