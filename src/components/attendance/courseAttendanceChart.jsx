import React from 'react';
import BarChartSvg from '../charts/barChartSvg.jsx';
import SentimentLegend from './sentimentLegend.jsx';
import { ATTENDANCE_SENTIMENTS, NO_RESPONSE_COLOR, sentimentSegments } from './attendanceUtils.js';

// Course-wide attendance over time. Each session's bar stacks the learners' answers to the
// standard wellness question (best -> worst) so turnout and mood read together; the total
// height is the number who checked in. Used by the instructor Attendance view and the
// MasteryView course overview. Pass sessions to render already loaded data, otherwise they
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

  let sawNoResponse = false;
  const dateGroups = sessions.map((session) => {
    const label = new Date(session.openedAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
    // Tally for this session's question (the standard wellness question going forward).
    const questionId = session.questions?.[0]?.id;
    const answerCounts = (questionId && session.answerTally?.[questionId]) || {};
    const segments = sentimentSegments(answerCounts, session.attendeeCount);
    if (segments.some((segment) => segment.key === '__none__')) sawNoResponse = true;
    return {
      day: session.id,
      ts: new Date(session.openedAt).getTime(),
      count: session.attendeeCount,
      segments,
      title: `${label}: ${session.attendeeCount} present`,
    };
  });
  const average = Math.round(dateGroups.reduce((sum, group) => sum + group.count, 0) / dateGroups.length);

  const legend = [...ATTENDANCE_SENTIMENTS, ...(sawNoResponse ? [{ value: 'No response', color: NO_RESPONSE_COLOR }] : [])];

  return (
    <div data-testid="course-attendance-chart">
      <div className="text-sm text-gray-700 mb-2">
        {sessions.length} class{sessions.length !== 1 ? 'es' : ''} recorded, average attendance <strong>{average}</strong>
      </div>
      <SentimentLegend items={legend} className="mb-2" />
      <BarChartSvg dateGroups={dateGroups} yLabel="Attendees" unit="attendee" ariaLabel="Course attendance chart" showTime />
    </div>
  );
}
