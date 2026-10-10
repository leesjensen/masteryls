import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAttendanceHistory, tallyAttendanceAnswers, DEFAULT_ATTENDANCE_QUESTION } from './attendanceUtils.js';

test('buildAttendanceHistory marks attended sessions and sorts oldest first', () => {
  const sessions = [
    { id: 's2', openedAt: '2026-10-08T15:00:00Z' },
    { id: 's1', openedAt: '2026-10-06T15:00:00Z' },
    { id: 's3', openedAt: '2026-10-10T15:00:00Z' },
  ];
  const rows = [{ interactionId: 's1' }, { interactionId: 's3' }];
  const history = buildAttendanceHistory(sessions, rows);
  assert.deepEqual(
    history.map((entry) => [entry.session.id, entry.present]),
    [
      ['s1', true],
      ['s2', false],
      ['s3', true],
    ],
  );
});

test('tallyAttendanceAnswers counts answers for every question choice', () => {
  const responses = [{ details: { answers: { q1: 'Good' } } }, { details: { answers: { q1: 'Good' } } }, { details: { answers: { q1: 'Struggling' } } }, { details: {} }];
  const tally = tallyAttendanceAnswers([DEFAULT_ATTENDANCE_QUESTION], responses);
  assert.deepEqual(tally, { q1: { Great: 0, Good: 2, OK: 0, Struggling: 1 } });
});
