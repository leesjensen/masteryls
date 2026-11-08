export const COURSE_LEARNER_COHORT_MARKER = '<!-- pulse-cohort: course-students-no-staff-v1 -->';

function parseNumber(value) {
  const match = String(value || '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

export function extractPulseTrendPoint(pulse) {
  const markdown = String(pulse?.markdown || '');
  const createdAt = pulse?.createdAt ? new Date(pulse.createdAt) : null;
  const snapshotDate = markdown.match(/^\*\*Snapshot date:\*\*\s*(\d{4}-\d{2}-\d{2})\s*$/m)?.[1]
    || (createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.toISOString().slice(0, 10) : null);
  if (!snapshotDate) return null;

  const statusStart = markdown.search(/^##\s+Status indicators\s*$/im);
  if (statusStart < 0) return null;
  const afterHeading = markdown.slice(statusStart).replace(/^##\s+Status indicators\s*\n/i, '');
  const nextHeading = afterHeading.search(/^##\s+/m);
  const statusSection = nextHeading < 0 ? afterHeading : afterHeading.slice(0, nextHeading);
  const point = { snapshotDate };

  for (const line of statusSection.split(/\r?\n/)) {
    const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.replace(/[*_`]/g, '').trim());
    if (cells.length < 2) continue;
    const label = cells[0].toLowerCase();
    const value = parseNumber(cells[1]);
    if (value == null) continue;
    if (label.includes('mastery') && !label.includes('median') && (label.includes('avg') || label.includes('average'))) {
      point.masteryPercent = value;
    } else if (label.includes('topics') && label.includes('completed') && !label.includes('median') && (label.includes('avg') || label.includes('average'))) {
      point.averageCompletedTopics = value;
    } else if (label.includes('canvas') && label.includes('overall') && (label.includes('avg') || label.includes('average'))) {
      point.canvasAveragePercent = value;
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

