import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPulseMetricsMarker, buildPulseTrendHistory, COURSE_LEARNER_COHORT_MARKER, extractPulseTrendPoint } from './pulseTrend.js';

// A current-style pulse carries the machine-written metrics marker, so extraction never depends on the
// status-table wording.
function pulse(date, mastery, grade = 89) {
  return {
    createdAt: `${date}T12:00:00Z`,
    markdown: `Lead summary.\n\n## Status indicators\n| Measure | Value |\n| :--- | :--- |\n| Cumulative Mastery (Avg) | ${mastery}% |\n\n## Change since the previous pulse\nOld text\n\n${buildPulseMetricsMarker({ date, mastery, canvasAveragePercent: grade })}\n`,
  };
}

test('buildPulseMetricsMarker rounds and omits absent fields', () => {
  assert.equal(buildPulseMetricsMarker({ date: '2026-11-10', mastery: 47.345, canvasAveragePercent: 90.17 }), '<!-- pulse-metrics: date=2026-11-10 mastery=47.3 canvas=90.2 -->');
  assert.equal(buildPulseMetricsMarker({ date: '2026-11-10', mastery: 50 }), '<!-- pulse-metrics: date=2026-11-10 mastery=50 -->');
});

test('extracts mastery and Canvas grade from the metrics marker (no completed topics)', () => {
  assert.deepEqual(extractPulseTrendPoint(pulse('2026-11-07', 44.5)), {
    snapshotDate: '2026-11-07',
    masteryPercent: 44.5,
    canvasAveragePercent: 89,
  });
});

test('learner pulse mastery is extracted from the marker even when the table has no "avg" label', () => {
  const learnerPulse = {
    createdAt: '2026-11-07T12:00:00Z',
    markdown: `Lead.\n\n## Status indicators\n| Metric | Value |\n| :-- | :-- |\n| Topic Mastery | 9% |\n\n${buildPulseMetricsMarker({ date: '2026-11-07', mastery: 9 })}\n`,
  };
  assert.deepEqual(extractPulseTrendPoint(learnerPulse), { snapshotDate: '2026-11-07', masteryPercent: 9 });
});

test('legacy pulse without a marker still parses the status table (mastery + Canvas)', () => {
  const legacy = {
    createdAt: '2026-11-05T12:00:00Z',
    markdown: `## Status indicators\n| Measure | Value |\n| :-- | :-- |\n| Canvas Overall Grade (Avg) | 88% |\n| Cumulative Mastery (Avg) | 41% |\n`,
  };
  assert.deepEqual(extractPulseTrendPoint(legacy), { snapshotDate: '2026-11-05', masteryPercent: 41, canvasAveragePercent: 88 });
});

test('builds a bounded chronological pulse trend while deduplicating same-day snapshots', () => {
  const history = buildPulseTrendHistory([
    pulse('2026-11-08', 44.5),
    pulse('2026-11-08', 44.2),
    pulse('2026-11-07', 43),
    pulse('2026-11-06', 42),
  ], 2);

  assert.deepEqual(history, [
    { snapshotDate: '2026-11-07', masteryPercent: 43, canvasAveragePercent: 89 },
    { snapshotDate: '2026-11-08', masteryPercent: 44.5, canvasAveragePercent: 89 },
  ]);
});

test('course pulse trend history skips snapshots made before course staff were excluded', () => {
  const oldPulse = pulse('2026-11-06', 42);
  const eligiblePulse = pulse('2026-11-07', 43);
  eligiblePulse.markdown += `\n${COURSE_LEARNER_COHORT_MARKER}`;

  assert.deepEqual(buildPulseTrendHistory([eligiblePulse, oldPulse], 8, { requireCourseLearnerCohort: true }), [
    { snapshotDate: '2026-11-07', masteryPercent: 43, canvasAveragePercent: 89 },
  ]);
});
