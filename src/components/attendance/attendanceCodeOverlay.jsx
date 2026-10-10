import React from 'react';

const COUNT_REFRESH_MS = 5000;

// Shown over the instructor's Attendance view while a session is open, so the code can be
// projected for the class. Refreshes the check-in count while open.
export default function AttendanceCodeOverlay({ courseOps, session, onClose }) {
  const [attendeeCount, setAttendeeCount] = React.useState(0);
  const [enrolledCount, setEnrolledCount] = React.useState(null);
  const [closing, setClosing] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    async function refresh() {
      if (typeof document !== 'undefined' && document.hidden) return;
      try {
        const result = await courseOps.getAttendanceSessions(session.catalogId);
        const current = result.sessions.find((candidate) => candidate.id === session.id);
        if (!cancelled) {
          setAttendeeCount(current?.attendeeCount || 0);
          setEnrolledCount(result.enrolledCount);
        }
      } catch {
        // Keep showing the last count; the next refresh will try again.
      }
    }
    refresh();
    const timer = setInterval(refresh, COUNT_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [session.id]);

  async function close() {
    setClosing(true);
    try {
      await onClose();
    } finally {
      setClosing(false);
    }
  }

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-white/95 p-6 text-center" data-testid="attendance-code-overlay">
      <div className="text-xl font-semibold text-gray-600">Attendance code</div>
      <div className="font-mono font-bold text-gray-900 tracking-[0.2em] leading-none" style={{ fontSize: 'min(28vw, 12rem)' }} aria-label="Attendance code value">
        {session.code}
      </div>
      {(session.questions || []).map((question) => (
        <div key={question.id} className="text-lg text-gray-600">
          {question.prompt}
        </div>
      ))}
      <div className="text-lg text-gray-700">
        <strong>{attendeeCount}</strong>
        {enrolledCount != null && ` of ${enrolledCount}`} checked in
      </div>
      <button type="button" onClick={close} disabled={closing} className="px-6 py-3 rounded-md text-white font-semibold bg-red-600 hover:bg-red-700 disabled:bg-gray-300">
        {closing ? 'Closing...' : 'Close attendance'}
      </button>
    </div>
  );
}
