import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScheduleTimingContext, canvasTimestampToPulseDate, comparePulseCanvasDueDates, roundWholePercent, summarizeUpcomingDeadlines } from './scheduleTiming.js';

test('schedule timing compares elapsed and remaining inclusive calendar days', () => {
  assert.deepEqual(buildScheduleTimingContext({ startDate: '2026-11-01', endDate: '2026-11-30', asOf: '2026-11-16' }), {
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    asOfDate: '2026-11-16',
    totalDays: 30,
    daysElapsed: 15,
    percentScheduleWindowElapsed: 50,
  });
});

test('schedule timing clamps before-start and after-end dates', () => {
  const beforeStart = buildScheduleTimingContext({ startDate: '2026-11-10', endDate: '2026-11-30', asOf: '2026-11-01' });
  const afterEnd = buildScheduleTimingContext({ startDate: '2026-11-01', endDate: '2026-11-10', asOf: '2026-11-20' });

  assert.equal(beforeStart.daysElapsed, 0);
  assert.equal(beforeStart.percentScheduleWindowElapsed, 0);
  assert.equal(afterEnd.daysElapsed, 10);
  assert.equal(afterEnd.percentScheduleWindowElapsed, 100);
});

test('schedule timing keeps dates while marking an incomplete or invalid range unknown', () => {
  const oneSided = buildScheduleTimingContext({ startDate: '2026-11-01', asOf: '2026-11-06' });
  const invalid = buildScheduleTimingContext({ startDate: '2026-11-30', endDate: '2026-11-01', asOf: '2026-11-06' });

  assert.equal(oneSided.startDate, '2026-11-01');
  assert.equal(oneSided.endDate, null);
  assert.equal(oneSided.percentScheduleWindowElapsed, null);
  assert.equal(invalid.percentScheduleWindowElapsed, null);
});

test('upcoming deadlines use dated work items rather than the schedule end or empty finals week', () => {
  const context = summarizeUpcomingDeadlines({
    asOf: new Date(2026, 10, 6, 12),
    scheduleItems: [
      { date: 'Nov 10', title: 'Metrics assignment', status: 'incomplete' },
      { date: 'Nov 17', title: 'Logging assignment', status: 'unknown' },
      { date: 'Nov 27', title: 'Completed exam', status: 'complete' },
    ],
    canvasAssignments: [
      { name: 'Canvas project', dueAt: '2026-11-20T23:59:00-07:00', submittedAt: null },
      { name: 'Phase 4', dueAt: '2026-11-14T23:59:00-07:00', learnerDueDate: '2026-11-14', courseDueAt: '2026-10-31T23:59:00-06:00', courseDueDate: '2026-10-31', dueDateAdjustment: 'later', submittedAt: null },
      { name: 'Already submitted', dueAt: '2026-11-25T23:59:00-07:00', submittedAt: '2026-11-01T12:00:00Z' },
    ],
  });

  assert.equal(context.nextKnownDueDate, '2026-11-10');
  assert.equal(context.latestKnownUpcomingDueDate, '2026-11-20');
  assert.deepEqual(context.latestKnownUpcomingDueItems, [{ title: 'Canvas project', source: 'Canvas' }]);
  assert.deepEqual(context.upcomingDeadlines.find((item) => item.title === 'Phase 4'), {
    date: '2026-11-14',
    title: 'Phase 4',
    source: 'Canvas learner-specific extension',
    originalCourseDate: '2026-10-31',
  });
  assert.equal(context.upcomingDeadlines.some((item) => item.title === 'Already submitted'), false);
  assert.equal(context.upcomingDeadlines.some((item) => item.title === 'Completed exam'), false);
  assert.equal(roundWholePercent(96.02), 96);
  assert.equal(roundWholePercent(null), null);
});

test('Canvas timestamps use the course Mountain calendar date across UTC midnight and DST', () => {
  assert.equal(canvasTimestampToPulseDate('2026-10-23T05:59:00Z'), '2026-10-22');
  assert.equal(canvasTimestampToPulseDate('2026-11-01T05:59:00Z'), '2026-10-31');
  assert.equal(canvasTimestampToPulseDate('2026-11-14T01:00:00Z'), '2026-11-13');
  assert.equal(canvasTimestampToPulseDate('2026-11-15T06:59:59Z'), '2026-11-14');
  assert.equal(comparePulseCanvasDueDates('2026-11-06T06:59:59Z', '2026-10-23T05:59:00Z'), 'later');
  assert.equal(comparePulseCanvasDueDates('2026-10-23T05:59:00Z', '2026-10-23T05:59:00Z'), null);
});
