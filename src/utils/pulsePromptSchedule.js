// Pure logic for the learner self-pulse reminder: when the classroom should nudge a learner to take
// their own pulse. Kept free of React/DOM so the date math is unit-tested.

const DAY_MS = 86400000;
const SEVEN_DAYS_MS = 7 * DAY_MS;
export const PULSE_PROMPT_COOLDOWN_MS = 12 * 60 * 60 * 1000;

export function localIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * True only when `today` falls within the schedule's dated window. A schedule with no start AND no
 * end date (or no schedule) has no window to be "between", so it returns false — the reminder never
 * fires outside, before, or after a dated schedule. Dates are 'YYYY-MM-DD' calendar strings compared
 * lexicographically (same convention as sectionEnrollment.js).
 */
export function isWithinScheduleWindow(schedule, today = localIsoDate()) {
  const start = schedule?.startDate || null;
  const end = schedule?.endDate || null;
  if (!start && !end) return false;
  if (start && today < start) return false;
  if (end && today > end) return false;
  return true;
}

/** Explicit enrollment preference wins; otherwise course overseers default to reminders off. */
export function arePulseRemindersDisabled(enrollment, user, courseId) {
  const configured = enrollment?.settings?.pulsePromptsDisabled;
  if (typeof configured === 'boolean') return configured;
  return Boolean(user?.canOverseeCourse?.(courseId));
}

function toMs(value) {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Prompt when reminders are enabled, the last pulse is ≥7 days old (or there is none), and the
 * dismissal cooldown has elapsed. Timestamps accept epoch ms, ISO strings, or null.
 */
export function shouldPromptForPulse({ lastPulseAt = null, nextPromptAt = null, pulsePromptsDisabled = false, now = Date.now() } = {}) {
  if (pulsePromptsDisabled) return false;
  const pulseMs = toMs(lastPulseAt);
  const pulseStale = pulseMs == null || now - pulseMs >= SEVEN_DAYS_MS;
  const nextPromptMs = toMs(nextPromptAt);
  const cooldownElapsed = nextPromptMs == null || now >= nextPromptMs;
  return pulseStale && cooldownElapsed;
}

export function pulsePromptCooldownRemaining(nextPromptAt, now = Date.now()) {
  const nextPromptMs = toMs(nextPromptAt);
  return nextPromptMs == null ? 0 : Math.max(0, nextPromptMs - now);
}
