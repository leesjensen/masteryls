// Pure logic for the learner self-pulse reminder: when the classroom should nudge a learner to take
// their own pulse. Kept free of React/DOM so the date math is unit-tested.

const DAY_MS = 86400000;
const SEVEN_DAYS_MS = 7 * DAY_MS;

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

function toMs(value) {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Prompt only when reminders are enabled, the last pulse is ≥7 days old (or there is none), and the
 * learner has not been prompted in the last 24h. `lastPulseAt`/`lastPromptedAt` accept epoch ms, an
 * ISO string, or null.
 */
export function shouldPromptForPulse({ lastPulseAt = null, lastPromptedAt = null, pulsePromptsDisabled = false, now = Date.now() } = {}) {
  if (pulsePromptsDisabled) return false;
  const pulseMs = toMs(lastPulseAt);
  const promptMs = toMs(lastPromptedAt);
  const pulseStale = pulseMs == null || now - pulseMs >= SEVEN_DAYS_MS;
  const promptCooled = promptMs == null || now - promptMs >= DAY_MS;
  return pulseStale && promptCooled;
}
