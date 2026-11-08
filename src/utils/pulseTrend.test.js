import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPulseTrendHistory, COURSE_LEARNER_COHORT_MARKER, extractPulseTrendPoint } from './pulseTrend.js';

function pulse(date, mastery, topics, grade = 89) {
  return {
    createdAt: `${date}T12:00:00Z`,
    markdown: `# Course Pulse\n\n**Snapshot date:** ${date}\n\n## Status indicators\n| Measure | Value |\n| :--- | :--- |\n| Rostered Learners | 186 |\n| Canvas Overall Grade (Avg) | ${grade}% |\n| Cumulative Mastery (Avg) | ${mastery}% |\n| Cumulative Topics Completed (Avg) | ${topics} |\n\n## Change since the previous pulse\nOld text`,
  };
}

test('extracts comparable mastery, topic completion, and Canvas grade metrics from a pulse', () => {
  assert.deepEqual(extractPulseTrendPoint(pulse('2026-11-07', 44.5, 44)), {
    snapshotDate: '2026-11-07',
    canvasAveragePercent: 89,
    masteryPercent: 44.5,
    averageCompletedTopics: 44,
  });
});

test('builds a bounded chronological pulse trend while deduplicating same-day snapshots', () => {
  const history = buildPulseTrendHistory([
    pulse('2026-11-08', 44.5, 44),
    pulse('2026-11-08', 44.2, 43),
    pulse('2026-11-07', 43, 42),
    pulse('2026-11-06', 42, 41),
  ], 2);

  assert.deepEqual(history, [
    { snapshotDate: '2026-11-07', canvasAveragePercent: 89, masteryPercent: 43, averageCompletedTopics: 42 },
    { snapshotDate: '2026-11-08', canvasAveragePercent: 89, masteryPercent: 44.5, averageCompletedTopics: 44 },
  ]);
});

test('course pulse trend history skips snapshots made before course staff were excluded', () => {
  const oldPulse = pulse('2026-11-06', 42, 41);
  const eligiblePulse = pulse('2026-11-07', 43, 42);
  eligiblePulse.markdown += `\n${COURSE_LEARNER_COHORT_MARKER}`;

  assert.deepEqual(buildPulseTrendHistory([eligiblePulse, oldPulse], 8, { requireCourseLearnerCohort: true }), [
    { snapshotDate: '2026-11-07', canvasAveragePercent: 89, masteryPercent: 43, averageCompletedTopics: 42 },
  ]);
});
