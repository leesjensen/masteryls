import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeRecordedEnrollment } from './learningSessionMerge.js';

const git = { id: 'git', title: 'Git' };
const github = { id: 'github', title: 'GitHub' };

test('merges the enrollment but keeps the CURRENT topic (the mismatch-bug regression)', () => {
  // The learner left GitHub and is now on Git; GitHub's closing flush records progress and the fresh
  // enrollment comes back. It must update the enrollment without reverting the topic to GitHub.
  const prev = { course: { id: 'c' }, topic: git, enrollment: { id: 'e1', progress: { old: true } } };
  const next = mergeRecordedEnrollment(prev, { id: 'e1', progress: { fresh: true } });
  assert.equal(next.topic, git); // topic preserved
  assert.deepEqual(next.enrollment, { id: 'e1', progress: { fresh: true } }); // enrollment updated
  assert.equal(next.course, prev.course);
  assert.notEqual(next, prev); // a new object (so React re-renders)
});

test('leaves the session untouched when the enrollment belongs to a different session', () => {
  const prev = { topic: github, enrollment: { id: 'e1' } };
  assert.equal(mergeRecordedEnrollment(prev, { id: 'e2', progress: {} }), prev);
});

test('is null/empty safe', () => {
  assert.equal(mergeRecordedEnrollment(null, { id: 'e1' }), null);
  const prev = { topic: git, enrollment: { id: 'e1' } };
  assert.equal(mergeRecordedEnrollment(prev, null), prev);
  assert.equal(mergeRecordedEnrollment(prev, undefined), prev);
});
