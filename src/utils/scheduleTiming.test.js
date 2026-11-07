import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScheduleTimingContext } from './scheduleTiming.js';

test('schedule timing compares elapsed and remaining inclusive calendar days', () => {
  assert.deepEqual(buildScheduleTimingContext({ startDate: '2026-11-01', endDate: '2026-11-30', asOf: '2026-11-16' }), {
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    asOfDate: '2026-11-16',
    totalDays: 30,
    daysElapsed: 15,
    daysRemaining: 15,
    percentTimeElapsed: 50,
  });
});

test('schedule timing clamps before-start and after-end dates', () => {
  const beforeStart = buildScheduleTimingContext({ startDate: '2026-11-10', endDate: '2026-11-30', asOf: '2026-11-01' });
  const afterEnd = buildScheduleTimingContext({ startDate: '2026-11-01', endDate: '2026-11-10', asOf: '2026-11-20' });

  assert.equal(beforeStart.daysElapsed, 0);
  assert.equal(beforeStart.daysRemaining, 21);
  assert.equal(beforeStart.percentTimeElapsed, 0);
  assert.equal(afterEnd.daysElapsed, 10);
  assert.equal(afterEnd.daysRemaining, 0);
  assert.equal(afterEnd.percentTimeElapsed, 100);
});

test('schedule timing keeps dates while marking an incomplete or invalid range unknown', () => {
  const oneSided = buildScheduleTimingContext({ startDate: '2026-11-01', asOf: '2026-11-06' });
  const invalid = buildScheduleTimingContext({ startDate: '2026-11-30', endDate: '2026-11-01', asOf: '2026-11-06' });

  assert.equal(oneSided.startDate, '2026-11-01');
  assert.equal(oneSided.endDate, null);
  assert.equal(oneSided.percentTimeElapsed, null);
  assert.equal(invalid.percentTimeElapsed, null);
});
