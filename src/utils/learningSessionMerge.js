// Merge a freshly-recorded enrollment into the current learning session without disturbing the rest
// of the session — notably its `topic`. Used with a functional `setLearningSession` update so a late
// progress write (e.g. a closing time-flush from the topic the learner just left, which resolves
// AFTER they have navigated on) updates only the enrollment and cannot clobber the now-current topic.
// Returns `prev` unchanged when it is null, there is no enrollment, or the enrollment belongs to a
// different session (e.g. after switching learners in observe mode).
export function mergeRecordedEnrollment(prev, enrollment) {
  if (!prev || !enrollment || prev.enrollment?.id !== enrollment.id) return prev;
  return { ...prev, enrollment };
}
