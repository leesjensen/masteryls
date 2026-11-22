import React from 'react';
import { useNavigate } from 'react-router-dom';
import { arePulseRemindersDisabled, isWithinScheduleWindow, PULSE_PROMPT_COOLDOWN_MS, pulsePromptCooldownRemaining, shouldPromptForPulse } from '../utils/pulsePromptSchedule.js';
import useOnlineStatus from './useOnlineStatus.js';

// Per-device `lastPulseAt` fallback and the dismissal-based `nextPromptAt` live inside the course's
// local `uiSettings` blob (`uiSettings-<courseId>`). The authoritative last pulse still comes from
// the DB so a pulse taken on another device suppresses the reminder. All access is guarded.
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
 * actions. Fires for the enrolled user themselves (including course overseers with their own
 * enrollment, but not while observing), within their dated schedule window, when reminders aren't
 * opted out, and the last pulse is at least seven days old.
 */
export default function usePulsePromptReminder({ courseOps, learningSession }) {
  const isOnline = useOnlineStatus();
  const navigate = useNavigate();
  const [visible, setVisible] = React.useState(false);
  const [promptCheckVersion, setPromptCheckVersion] = React.useState(0);

  const enrollment = learningSession?.enrollment;
  const course = learningSession?.course;
  const user = courseOps?.user;

  // Nudge the enrolled user themselves, including mentors/editors/root who also have an
  // enrollment. Never prompt an overseer while they are observing someone else's enrollment.
  const isOwnLearner = Boolean(user && enrollment && enrollment.learnerId === user.id && !learningSession?.observeMode);
  const pulsePromptsDisabled = arePulseRemindersDisabled(enrollment, user, course?.id);

  const scheduleActive = React.useMemo(() => {
    if (!enrollment?.sectionId || !course) return false;
    const section = (course.sections || []).find((s) => String(s.id) === String(enrollment.sectionId));
    if (!section?.scheduleId) return false;
    const schedule = (course.schedules || []).find((sc) => String(sc.id) === String(section.scheduleId));
    return schedule ? isWithinScheduleWindow(schedule) : false;
  }, [enrollment?.sectionId, course?.sections, course?.schedules]);

  React.useEffect(() => {
    setVisible(false);
    if (!isOnline || course?.offlineCached || !isOwnLearner || pulsePromptsDisabled || !scheduleActive) return undefined;

    let cancelled = false;
    let cooldownTimer = null;
    (async () => {
      const service = courseOps.service;
      const promptState = readPulsePromptState(service, course.id);
      let lastPulseAt = promptState.lastPulseAt || null;
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
      const now = Date.now();
      if (shouldPromptForPulse({ lastPulseAt, nextPromptAt: promptState.nextPromptAt, pulsePromptsDisabled, now })) {
        setVisible(true);
      } else {
        const delay = pulsePromptCooldownRemaining(promptState.nextPromptAt, now);
        if (delay > 0) {
          cooldownTimer = setTimeout(() => {
            if (!cancelled) setPromptCheckVersion((version) => version + 1);
          }, delay);
        }
      }
    })();
    return () => {
      cancelled = true;
      if (cooldownTimer) clearTimeout(cooldownTimer);
    };
  }, [enrollment?.id, isOwnLearner, isOnline, pulsePromptsDisabled, scheduleActive, promptCheckVersion]);

  const openPulse = () => {
    setVisible(false);
    // Navigate to the pulse view AND auto-start the pulse there (one-shot `take=1`). Generating here
    // in the classroom would abort the request on navigation, so the pulse page kicks it off instead.
    if (course?.id) navigate(`/course/${course.id}/mastery?tab=pulses&take=1`);
  };
  const snooze = () => {
    writePulsePromptState(courseOps.service, course?.id, { nextPromptAt: Date.now() + PULSE_PROMPT_COOLDOWN_MS });
    setVisible(false);
    setPromptCheckVersion((version) => version + 1);
  };
  return { visible, openPulse, snooze };
}
