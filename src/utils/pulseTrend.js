export const COURSE_LEARNER_COHORT_MARKER = '<!-- pulse-cohort: course-students-no-staff-v1 -->';

function parseNumber(value) {
  const match = String(value || '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

/**
 * A machine-written marker of a pulse's headline metrics, appended when the pulse is generated. Trend
 * extraction reads this instead of parsing the model's status table, so it never depends on the
 * table's wording (learner tables omit "avg", which the old table parser required — the reason learner
 * trend charts never grew). Values are rounded to one decimal.
 */
export function buildPulseMetricsMarker({ date = null, mastery = null, canvasAveragePercent = null } = {}) {
  const parts = [];
  if (date) parts.push(`date=${date}`);
  if (mastery != null && Number.isFinite(Number(mastery))) parts.push(`mastery=${Math.round(Number(mastery) * 10) / 10}`);
  if (canvasAveragePercent != null && Number.isFinite(Number(canvasAveragePercent))) parts.push(`canvas=${Math.round(Number(canvasAveragePercent) * 10) / 10}`);
  return `<!-- pulse-metrics: ${parts.join(' ')} -->`;
}

export function extractPulseTrendPoint(pulse) {
  const markdown = String(pulse?.markdown || '');
  const createdAt = pulse?.createdAt ? new Date(pulse.createdAt) : null;

  // Prefer the machine-written metrics marker; fall back to the status table for legacy pulses.
  const markerText = markdown.match(/<!--\s*pulse-metrics:\s*([^>]*?)\s*-->/)?.[1] || '';
  const markerDate = markerText.match(/\bdate=(\d{4}-\d{2}-\d{2})\b/)?.[1] || null;
  const markerMastery = parseNumber(markerText.match(/\bmastery=(-?\d+(?:\.\d+)?)/)?.[1]);
  const markerCanvas = parseNumber(markerText.match(/\bcanvas=(-?\d+(?:\.\d+)?)/)?.[1]);

  const snapshotDate = markerDate
    || markdown.match(/^\*\*Snapshot date:\*\*\s*(\d{4}-\d{2}-\d{2})\s*$/m)?.[1]
    || (createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.toISOString().slice(0, 10) : null);
  if (!snapshotDate) return null;

  const point = { snapshotDate };
  if (markerMastery != null) point.masteryPercent = markerMastery;
  if (markerCanvas != null) point.canvasAveragePercent = markerCanvas;

  if (point.masteryPercent === undefined || point.canvasAveragePercent === undefined) {
    const statusStart = markdown.search(/^##\s+Status indicators\s*$/im);
    if (statusStart >= 0) {
      const afterHeading = markdown.slice(statusStart).replace(/^##\s+Status indicators\s*\n/i, '');
      const nextHeading = afterHeading.search(/^##\s+/m);
      const statusSection = nextHeading < 0 ? afterHeading : afterHeading.slice(0, nextHeading);
      for (const line of statusSection.split(/\r?\n/)) {
        const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.replace(/[*_`]/g, '').trim());
        if (cells.length < 2) continue;
        const label = cells[0].toLowerCase();
        const value = parseNumber(cells[1]);
        if (value == null) continue;
        if (point.masteryPercent === undefined && label.includes('mastery') && !label.includes('median') && (label.includes('avg') || label.includes('average'))) {
          point.masteryPercent = value;
        } else if (point.canvasAveragePercent === undefined && label.includes('canvas') && label.includes('overall') && (label.includes('avg') || label.includes('average'))) {
          point.canvasAveragePercent = value;
        }
      }
    }
  }

  return Object.keys(point).length > 1 ? point : null;
}

/** Returns up to eight distinct-date snapshots in chronological order. */
export function buildPulseTrendHistory(pulses = [], limit = 8, { requireCourseLearnerCohort = false } = {}) {
  const byDate = new Map();
  for (const pulse of Array.isArray(pulses) ? pulses : []) {
    if (requireCourseLearnerCohort && !String(pulse?.markdown || '').includes(COURSE_LEARNER_COHORT_MARKER)) continue;
    const point = extractPulseTrendPoint(pulse);
    if (point && !byDate.has(point.snapshotDate)) byDate.set(point.snapshotDate, point);
  }
  return [...byDate.values()].sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate)).slice(-Math.max(1, limit));
}

