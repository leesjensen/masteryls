import { parseScheduleDisplayDate } from './scheduleMarkdown.js';

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
    percentScheduleWindowElapsed: null,
  };

  if (start == null || end == null || today == null || end < start) return context;

  const totalDays = Math.floor((end - start) / DAY_MS) + 1;
  const daysElapsed = Math.min(totalDays, Math.max(0, Math.floor((today - start) / DAY_MS)));
  return {
    ...context,
    totalDays,
    daysElapsed,
    percentScheduleWindowElapsed: Math.round((daysElapsed / totalDays) * 100),
  };
}

function localDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Find the actual upcoming work horizon from dated, incomplete schedule items and Canvas
 * assignments. The schedule's end date is deliberately not treated as the last work deadline.
 */
export function summarizeUpcomingDeadlines({ scheduleItems = [], canvasAssignments = [], asOf = new Date() } = {}) {
  const today = new Date(asOf);
  today.setHours(0, 0, 0, 0);
  if (Number.isNaN(today.getTime())) return { status: 'unavailable', upcomingDeadlines: [] };

  const candidates = [];
  for (const item of Array.isArray(scheduleItems) ? scheduleItems : []) {
    if (!item?.date || !item?.title || item.status === 'complete') continue;
    const date = parseScheduleDisplayDate(item.date, asOf);
    if (!date || date < today) continue;
    candidates.push({ date: localDateKey(date), title: String(item.title), source: 'schedule' });
  }
  for (const assignment of Array.isArray(canvasAssignments) ? canvasAssignments : []) {
    if (!assignment?.dueAt || !assignment?.name || assignment.submittedAt || assignment.excused) continue;
    const date = new Date(assignment.dueAt);
    if (Number.isNaN(date.getTime())) continue;
    date.setHours(0, 0, 0, 0);
    if (date < today) continue;
    candidates.push({ date: localDateKey(date), title: String(assignment.name), source: 'Canvas' });
  }

  const unique = [...new Map(candidates.map((entry) => [`${entry.date}|${entry.source}|${entry.title}`, entry])).values()]
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
  return {
    status: unique.length ? 'available' : 'no known upcoming work deadlines',
    upcomingDeadlines: unique.slice(0, 12),
    nextKnownDueDate: unique[0]?.date || null,
    nextKnownDueItems: unique.filter((entry) => entry.date === unique[0]?.date).map(({ title, source }) => ({ title, source })),
    latestKnownUpcomingDueDate: unique.at(-1)?.date || null,
    latestKnownUpcomingDueItems: unique.filter((entry) => entry.date === unique.at(-1)?.date).map(({ title, source }) => ({ title, source })),
  };
}

export function roundWholePercent(value) {
  return Number.isFinite(value) ? Math.round(value) : null;
}
