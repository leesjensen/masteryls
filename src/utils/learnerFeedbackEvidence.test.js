import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeLearnerActivity, summarizeSectionAttendance } from './learnerFeedbackEvidence.js';

test('activity evidence distinguishes an isolated current visit from the previous active date', () => {
  const summary = summarizeLearnerActivity([
    { createdAt: '2026-11-06T18:00:00.000Z', type: 'scheduleView', topicId: null, duration: 20, details: { privateText: 'omit this' } },
    { createdAt: '2026-10-23T18:00:00.000Z', type: 'instructionView', topicId: 'topic-1' },
  ], {
    asOf: new Date('2026-11-06T19:00:00.000Z'),
    topicTitleById: new Map([['topic-1', 'Interfaces']]),
    olderRecordsOmitted: true,
  });

  assert.equal(summary.eventsLast7Days, 1);
  assert.equal(summary.eventsLast30Days, 2);
  assert.equal(summary.eventsOnLatestDay, 1);
  assert.equal(summary.latestActivityAt, '2026-11-06T18:00:00.000Z');
  assert.equal(summary.previousActiveDay, '2026-10-23');
  assert.equal(summary.daysSincePreviousActiveDay, 14);
  assert.equal(summary.olderRecordsOmitted, true);
  assert.deepEqual(summary.recentEvents.map(({ type, topic }) => ({ type, topic })), [
    { type: 'scheduleView', topic: undefined },
    { type: 'instructionView', topic: 'Interfaces' },
  ]);
  assert.equal(JSON.stringify(summary).includes('omit this'), false);
});

test('attendance evidence counts only closed sessions and includes the learner wellness answers', () => {
  const summary = summarizeSectionAttendance([
    { id: 'session-1', openedAt: '2026-10-20T17:00:00Z', closedAt: '2026-10-20T18:00:00Z', questions: [{ id: 'q1', prompt: 'How are things going?' }] },
    { id: 'session-2', openedAt: '2026-10-27T17:00:00Z', closedAt: '2026-10-27T18:00:00Z', questions: [{ id: 'q1', prompt: 'How are things going?' }] },
    { id: 'session-3', openedAt: '2026-11-06T17:00:00Z', closedAt: null, questions: [{ id: 'q1', prompt: 'How are things going?' }] },
  ], [
    { interactionId: 'session-1', details: { answers: { q1: 'Good', other: 'ignored' } } },
    { interactionId: 'session-3', details: { answers: { q1: 'Struggling' } } },
  ]);

  assert.equal(summary.closedSessionCount, 2);
  assert.equal(summary.attendedClosedSessionCount, 1);
  assert.equal(summary.missedClosedSessionCount, 1);
  assert.equal(summary.attendancePercent, 50);
  assert.equal(summary.wellnessResponseCount, 2);
  assert.deepEqual(summary.wellnessResponsesByChoice, { Good: 1, Struggling: 1 });
  assert.deepEqual(summary.recentSessions.map(({ date, attended, closed, response }) => ({ date, attended, closed, response })), [
    { date: '2026-11-06T17:00:00Z', attended: true, closed: false, response: 'Struggling' },
    { date: '2026-10-27T17:00:00Z', attended: false, closed: true, response: undefined },
    { date: '2026-10-20T17:00:00Z', attended: true, closed: true, response: 'Good' },
  ]);
});

