import React from 'react';
import { useNavigate } from 'react-router-dom';
import { isWithinScheduleWindow, shouldPromptForPulse } from '../utils/pulsePromptSchedule.js';

// Per-device throttle state ({ lastPulseAt, lastPromptedAt }) lives inside the course's local
// `uiSettings` blob (`uiSettings-<courseId>`), so it is scoped per course like the rest of the
// learner's local prefs rather than a stray top-level key. The authoritative "last pulse" still comes
// from the DB so a pulse taken on another device suppresses the nudge. All access is guarded.
export function readPulsePromptState(service, courseId) {
  try {
    return service?.getEnrollmentUiSettings?.(courseId)?.pulsePrompt || {};
  } catch {
    return {};
  }
}

export function writePulsePromptState(service, courseId, patch) {
  if (!service?.saveEnrollmentUiSettings || !courseId) return;
  try {
    const current = readPulsePromptState(service, courseId);
    service.saveEnrollmentUiSettings(courseId, { pulsePrompt: { ...current, ...patch } });
  } catch {
    // ignore — the DB remains the source of truth for the last pulse
  }
}

/**
 * Decides whether to show the learner self-pulse reminder for the current course, and exposes its
 * actions. Only fires for the enrolled learner (not an overseer/observer), within the learner's dated
 * schedule window, when reminders aren't opted out, and subject to the 7-day / 24-hour throttle.
 */
export default function usePulsePromptReminder({ courseOps, learningSession }) {
  const navigate = useNavigate();
  const [visible, setVisible] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);

  const enrollment = learningSession?.enrollment;
  const course = learningSession?.course;
  const user = courseOps?.user;

  // Only a pure learner (enrolled, not an overseer of this course, not observing) is nudged.
  const isOwnLearner = Boolean(user && enrollment && enrollment.learnerId === user.id && !learningSession?.observeMode && !user.canOverseeCourse?.(course?.id));
  const pulsePromptsDisabled = enrollment?.settings?.pulsePromptsDisabled === true;

  const scheduleActive = React.useMemo(() => {
    if (!enrollment?.sectionId || !course) return false;
    const section = (course.sections || []).find((s) => String(s.id) === String(enrollment.sectionId));
    if (!section?.scheduleId) return false;
    const schedule = (course.schedules || []).find((sc) => String(sc.id) === String(section.scheduleId));
    return schedule ? isWithinScheduleWindow(schedule) : false;
  }, [enrollment?.sectionId, course?.sections, course?.schedules]);

  React.useEffect(() => {
    setVisible(false);
    setDismissed(false);
    if (!isOwnLearner || pulsePromptsDisabled || !scheduleActive) return undefined;

    let cancelled = false;
    (async () => {
      const service = courseOps.service;
      let lastPulseAt = readPulsePromptState(service, course.id).lastPulseAt || null;
      try {
        const latest = await service.getLatestLearnerPulses([enrollment.id]);
        const row = latest.get(enrollment.id);
        if (row?.createdAt) {
          lastPulseAt = row.createdAt;
          writePulsePromptState(service, course.id, { lastPulseAt });
        }
      } catch {
        // fall back to the cached lastPulseAt
      }
      if (cancelled) return;
      const { lastPromptedAt } = readPulsePromptState(service, course.id);
      if (shouldPromptForPulse({ lastPulseAt, lastPromptedAt, pulsePromptsDisabled })) {
        writePulsePromptState(service, course.id, { lastPromptedAt: Date.now() });
        setVisible(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enrollment?.id, isOwnLearner, pulsePromptsDisabled, scheduleActive]);

  const openPulse = () => {
    setVisible(false);
    // Navigate to the pulse view AND auto-start the pulse there (one-shot `take=1`). Generating here
    // in the classroom would abort the request on navigation, so the pulse page kicks it off instead.
    if (course?.id) navigate(`/course/${course.id}/mastery?tab=pulses&take=1`);
  };
  const snooze = () => {
    setVisible(false);
    setDismissed(true);
  };

  return { visible: visible && !dismissed, openPulse, snooze };
}
