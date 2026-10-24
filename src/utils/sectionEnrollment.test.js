import assert from 'node:assert/strict';
import test from 'node:test';

import { enrollableSections, isSectionEnrollable } from './sectionEnrollment.js';

const TODAY = '2026-06-15';

const schedules = [
  { id: 'sch-active', startDate: '2026-01-10', endDate: '2026-12-20' },
  { id: 'sch-past', startDate: '2025-01-10', endDate: '2025-12-20' },
  { id: 'sch-future', startDate: '2027-01-10', endDate: '2027-12-20' },
  { id: 'sch-undated', startDate: null, endDate: null },
  { id: 'sch-start-only', startDate: '2026-01-10', endDate: null },
  { id: 'sch-end-only', startDate: null, endDate: '2026-12-20' },
];
const byId = new Map(schedules.map((s) => [s.id, s]));

test('isSectionEnrollable: section with no schedule is always open', () => {
  assert.equal(isSectionEnrollable({ scheduleId: null }, byId, TODAY), true);
  assert.equal(isSectionEnrollable({}, byId, TODAY), true);
});

test('isSectionEnrollable: active schedule is open; past and future are not', () => {
  assert.equal(isSectionEnrollable({ scheduleId: 'sch-active' }, byId, TODAY), true);
  assert.equal(isSectionEnrollable({ scheduleId: 'sch-past' }, byId, TODAY), false);
  assert.equal(isSectionEnrollable({ scheduleId: 'sch-future' }, byId, TODAY), false);
});

test('isSectionEnrollable: undated schedule is always open', () => {
  assert.equal(isSectionEnrollable({ scheduleId: 'sch-undated' }, byId, TODAY), true);
});

test('isSectionEnrollable: one-sided ranges', () => {
  assert.equal(isSectionEnrollable({ scheduleId: 'sch-start-only' }, byId, TODAY), true); // after start
  assert.equal(isSectionEnrollable({ scheduleId: 'sch-start-only' }, byId, '2026-01-01'), false); // before start
  assert.equal(isSectionEnrollable({ scheduleId: 'sch-end-only' }, byId, TODAY), true); // before end
  assert.equal(isSectionEnrollable({ scheduleId: 'sch-end-only' }, byId, '2027-01-01'), false); // after end
});

test('isSectionEnrollable: boundary dates are inclusive', () => {
  assert.equal(isSectionEnrollable({ scheduleId: 'sch-active' }, byId, '2026-01-10'), true); // start day
  assert.equal(isSectionEnrollable({ scheduleId: 'sch-active' }, byId, '2026-12-20'), true); // end day
});

test('isSectionEnrollable: unknown schedule id does not block', () => {
  assert.equal(isSectionEnrollable({ scheduleId: 'missing' }, byId, TODAY), true);
});

test('enrollableSections filters to the active ones', () => {
  const sections = [
    { id: 'a', scheduleId: 'sch-active' },
    { id: 'b', scheduleId: 'sch-past' },
    { id: 'c', scheduleId: 'sch-future' },
    { id: 'd', scheduleId: null },
    { id: 'e', scheduleId: 'sch-undated' },
  ];
  const open = enrollableSections(sections, schedules, TODAY);
  assert.deepEqual(
    open.map((s) => s.id),
    ['a', 'd', 'e']
  );
});

test('enrollableSections handles empty/missing inputs', () => {
  assert.deepEqual(enrollableSections([], [], TODAY), []);
  assert.deepEqual(enrollableSections(null, null, TODAY), []);
});
