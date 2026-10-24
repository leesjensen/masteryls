// Which sections to offer at enrollment time. A section is offered only when its schedule's date
// range includes today; a section with no schedule (or a schedule without dates) is always offered.
// Schedule dates are 'YYYY-MM-DD' calendar strings, so lexicographic comparison is correct.

function todayIso() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * @param {{scheduleId?: string|null}} section
 * @param {Map<string, {startDate?: string|null, endDate?: string|null}>} schedulesById
 * @param {string} [today] - 'YYYY-MM-DD'; defaults to the local date.
 * @returns {boolean} true when the section should be offered for enrollment.
 */
export function isSectionEnrollable(section, schedulesById, today = todayIso()) {
  if (!section?.scheduleId) return true; // no schedule -> always open
  const schedule = schedulesById?.get?.(section.scheduleId);
  if (!schedule) return true; // schedule not loaded -> don't block
  const start = schedule.startDate || null;
  const end = schedule.endDate || null;
  if (!start && !end) return true; // undated schedule -> always open
  if (start && today < start) return false; // term hasn't started
  if (end && today > end) return false; // term has ended
  return true;
}

/**
 * Filter a course's sections to those currently open for enrollment.
 * @param {Array} sections
 * @param {Array} schedules
 * @param {string} [today]
 * @returns {Array}
 */
export function enrollableSections(sections = [], schedules = [], today = todayIso()) {
  const byId = new Map((Array.isArray(schedules) ? schedules : []).map((schedule) => [schedule.id, schedule]));
  return (Array.isArray(sections) ? sections : []).filter((section) => isSectionEnrollable(section, byId, today));
}
