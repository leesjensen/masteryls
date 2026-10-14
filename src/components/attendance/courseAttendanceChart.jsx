import React from 'react';
import BarChartSvg from '../charts/barChartSvg.jsx';

// Course-wide attendee counts for each session over time. Used by the instructor Attendance view
// and the MasteryView course overview. Pass sessions to render already loaded data, otherwise they
// are loaded for courseId.
export default function CourseAttendanceChart({ courseOps, courseId, sessions: providedSessions }) {
  const [loaded, setLoaded] = React.useState(null);
  const [error, setError] = React.useState(null);
  const provided = Array.isArray(providedSessions);

  React.useEffect(() => {
    if (provided || !courseId) return undefined;
    let cancelled = false;
    courseOps
      .getAttendanceSessions(courseId)
      .then((result) => {
        if (!cancelled) setLoaded(result);
      })
      .catch((ex) => {
        if (!cancelled) setError(ex.message);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId, provided]);

  const sessions = provided ? providedSessions : loaded?.sessions;

  if (error) return <div className="text-sm text-red-600">Unable to load attendance: {error}</div>;
  if (!sessions) return <div className="text-sm text-gray-500 py-4 text-center">Loading attendance...</div>;
  if (sessions.length === 0) return <div className="text-sm text-gray-500 py-4 text-center">No attendance has been taken yet.</div>;

  const dateGroups = sessions.map((session) => {
    const label = new Date(session.openedAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
    return {
      day: session.id,
      ts: new Date(session.openedAt).getTime(),
      count: session.attendeeCount,
      title: `${label}: ${session.attendeeCount} present`,
    };
  });
  const average = Math.round(dateGroups.reduce((sum, group) => sum + group.count, 0) / dateGroups.length);

  return (
    <div data-testid="course-attendance-chart">
      <div className="text-sm text-gray-700 mb-2">
        {sessions.length} class{sessions.length !== 1 ? 'es' : ''} recorded, average attendance <strong>{average}</strong>
      </div>
      <BarChartSvg dateGroups={dateGroups} yLabel="Attendees" unit="attendee" color="#10b981" ariaLabel="Course attendance chart" showTime />
    </div>
  );
}
