// Posting a learner's attendance grade to the Canvas "Attendance" assignment. Learners earn
// pointsPerSession for every class they check in to, capped at pointsPossible. The grade only
// goes up when a learner checks in, so a learner who never checks in simply has no grade.
//
// course.externalRefs.attendance = { canvasAssignmentId, pointsPerSession, pointsPossible }

export const DEFAULT_ATTENDANCE_POINTS_PER_SESSION = 2;
export const DEFAULT_ATTENDANCE_POINTS_POSSIBLE = 80;

export function getAttendanceGradeSettings(course) {
  const refs = course?.externalRefs?.attendance;
  if (!refs) return null;
  const pointsPerSession = Number(refs.pointsPerSession ?? DEFAULT_ATTENDANCE_POINTS_PER_SESSION);
  const pointsPossible = Number(refs.pointsPossible ?? DEFAULT_ATTENDANCE_POINTS_POSSIBLE);
  if (!Number.isFinite(pointsPerSession) || pointsPerSession <= 0 || !Number.isFinite(pointsPossible) || pointsPossible <= 0) {
    return null;
  }
  return {
    canvasAssignmentId: refs.canvasAssignmentId || null,
    pointsPerSession,
    pointsPossible,
  };
}

export function calculateAttendancePoints(attended, { pointsPerSession, pointsPossible }) {
  const count = Math.max(0, Math.floor(Number(attended) || 0));
  return Math.min(count * pointsPerSession, pointsPossible);
}

// Build the canvasgradebook request for a learner who has attended `attended` classes, or null
// when the course has no linked attendance assignment.
export function buildAttendanceGradeRequest({ course, learnerEmail, attended }) {
  const canvasCourseId = course?.externalRefs?.canvasCourseId;
  const settings = getAttendanceGradeSettings(course);
  if (!canvasCourseId || !settings?.canvasAssignmentId || !learnerEmail) {
    return null;
  }
  const points = calculateAttendancePoints(attended, settings);
  return {
    courseId: String(canvasCourseId),
    catalogId: course.id,
    topicType: 'attendance',
    percentCorrect: (points / settings.pointsPossible) * 100,
    pointsPossible: settings.pointsPossible,
    canvasAssignmentId: settings.canvasAssignmentId,
    learnerEmail,
    autoGrade: true,
  };
}
