import React from 'react';
import AttendanceCodeOverlay from './attendanceCodeOverlay.jsx';
import AttendanceSessionList from './attendanceSessionList.jsx';
import CourseAttendanceChart from './courseAttendanceChart.jsx';
import { DEFAULT_ATTENDANCE_QUESTION } from './attendanceUtils.js';

const ALL_SECTIONS_ID = '__all_sections__';

// Instructor (root/editor/mentor) Attendance view: attendance is taken per SECTION. The instructor
// picks a section, takes attendance when it is enabled in Terms & Sections, and reviews that
// section's past sessions. The all-sections option is for reviewing history only.
export default function AttendanceAdmin({ courseOps, course }) {
  const allSections = Array.isArray(course?.sections) ? course.sections : [];
  const sections = React.useMemo(() => allSections.filter((section) => section.attendanceEnabled), [course?.sections]);
  const [selectedSectionId, setSelectedSectionId] = React.useState(() => sections[0]?.id || ALL_SECTIONS_ID);
  const [openSession, setOpenSession] = React.useState(null);
  const [summary, setSummary] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [opening, setOpening] = React.useState(false);
  const viewingAllSections = selectedSectionId === ALL_SECTIONS_ID;
  const selectedSection = sections.find((section) => section.id === selectedSectionId) || null;
  const attendanceEnabled = Boolean(selectedSection?.attendanceEnabled);

  React.useEffect(() => {
    setSelectedSectionId((prev) => (
      prev === ALL_SECTIONS_ID || sections.some((section) => section.id === prev)
        ? prev
        : sections[0]?.id || ALL_SECTIONS_ID
    ));
  }, [course?.id, sections]);

  async function loadSummary() {
    if (!viewingAllSections && !selectedSectionId) {
      setSummary(null);
      return;
    }
    try {
      setSummary(await courseOps.getAttendanceSessions(course.id, viewingAllSections ? null : selectedSectionId));
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
    if (viewingAllSections) {
      setOpenSession(null);
      setError(null);
      loadSummary();
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
    if (!selectedSection || !attendanceEnabled) return;
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

  if (allSections.length === 0) {
    return (
      <div className="relative h-full w-full overflow-auto">
        <div className="max-w-4xl mx-auto p-4">
          <div className="rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-600">
            Attendance is taken per section. This course has no sections yet — add a schedule/section to enable attendance.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-auto">
      {openSession && !viewingAllSections && <AttendanceCodeOverlay courseOps={courseOps} session={openSession} onClose={closeAttendance} />}
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="rounded-md border border-gray-200 bg-white p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="text-sm text-gray-700 flex items-center gap-2">
              Section
              <select value={selectedSectionId} onChange={(e) => setSelectedSectionId(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm">
                <option value={ALL_SECTIONS_ID}>All sections</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.title || 'Section'}
                  </option>
                ))}
              </select>
            </label>
            {viewingAllSections && <span className="text-sm text-gray-600">Viewing all sections</span>}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-gray-600">
              {viewingAllSections
                ? sections.length > 0
                  ? 'Showing attendance sessions across all sections.'
                  : 'Showing attendance sessions across all sections. Enable attendance in Terms & Sections to take new attendance.'
                : <>Learners are asked <span className="font-medium text-gray-700">“{DEFAULT_ATTENDANCE_QUESTION.prompt}”</span> when they check in.</>}
            </div>
            {!viewingAllSections && (
              <button type="button" onClick={takeAttendance} disabled={opening || !attendanceEnabled} className="px-4 py-2 rounded-md text-white font-semibold text-sm bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300">
                {opening ? 'Opening...' : 'Take attendance'}
              </button>
            )}
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
