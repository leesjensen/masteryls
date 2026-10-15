import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAttendanceHistory, sentimentColor, sentimentSegments, NO_RESPONSE_COLOR } from './attendanceUtils.js';

test('buildAttendanceHistory marks attended sessions, carries answers, and sorts oldest first', () => {
  const question = [{ id: 'q1' }];
  const sessions = [
    { id: 's2', openedAt: '2026-10-08T15:00:00Z', questions: question },
    { id: 's1', openedAt: '2026-10-06T15:00:00Z', questions: question },
    { id: 's3', openedAt: '2026-10-10T15:00:00Z', questions: question },
    { id: 's4', openedAt: '2026-10-12T15:00:00Z' }, // legacy session without a question
  ];
  const rows = [
    { interactionId: 's1', details: { answers: { q1: 'Great' } } },
    { interactionId: 's3', details: { answers: { q1: 'Struggling' } } },
    { interactionId: 's4', details: {} },
  ];
  const history = buildAttendanceHistory(sessions, rows);
  assert.deepEqual(
    history.map((entry) => [entry.session.id, entry.present, entry.answer]),
    [
      ['s1', true, 'Great'],
      ['s2', false, null],
      ['s3', true, 'Struggling'],
      ['s4', true, null], // present but no question/answer
    ],
  );
});

test('sentimentColor maps known answers and falls back to neutral', () => {
  assert.equal(sentimentColor('Great'), '#059669');
  assert.equal(sentimentColor('Struggling'), '#f87171');
  assert.equal(sentimentColor('Mystery'), NO_RESPONSE_COLOR);
  assert.equal(sentimentColor(null), NO_RESPONSE_COLOR);
});

test('sentimentSegments orders sentiments best->worst and adds a No response remainder', () => {
  const segments = sentimentSegments({ Good: 2, Great: 1, Struggling: 1 }, 6);
  assert.deepEqual(
    segments.map((s) => [s.key, s.count]),
    [
      ['Great', 1],
      ['Good', 2],
      ['Struggling', 1],
      ['__none__', 2], // 6 attended - 4 answered
    ],
  );
});

test('sentimentSegments is all No response for a legacy session with no answers', () => {
  const segments = sentimentSegments({}, 3);
  assert.deepEqual(segments, [{ key: '__none__', label: 'No response', count: 3, color: NO_RESPONSE_COLOR }]);
});
