const DAY_MS = 24 * 60 * 60 * 1000;

function toUtcDay(value) {
  if (!value) return null;
  const text = String(value).trim();
  const dateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) return Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
}

function toIsoDate(day) {
  return day == null ? null : new Date(day).toISOString().slice(0, 10);
}

/**
 * Summarize a schedule's date window relative to a fixed/current date.
 * Date-only bounds are treated as inclusive calendar days.
 */
export function buildScheduleTimingContext({ startDate = null, endDate = null, asOf = new Date() } = {}) {
  const start = toUtcDay(startDate);
  const end = toUtcDay(endDate);
  const today = toUtcDay(asOf);
  const context = {
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
    asOfDate: toIsoDate(today),
    totalDays: null,
    daysElapsed: null,
    daysRemaining: null,
    percentTimeElapsed: null,
  };

  if (start == null || end == null || today == null || end < start) return context;

  const totalDays = Math.floor((end - start) / DAY_MS) + 1;
  const daysElapsed = Math.min(totalDays, Math.max(0, Math.floor((today - start) / DAY_MS)));
  const daysRemaining = Math.min(totalDays, Math.max(0, Math.floor((end - today) / DAY_MS) + 1));
  return {
    ...context,
    totalDays,
    daysElapsed,
    daysRemaining,
    percentTimeElapsed: Math.round((daysElapsed / totalDays) * 100),
  };
}
