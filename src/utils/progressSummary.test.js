import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveProgressSummary } from './progressSummary.js';

test('deriveProgressSummary calculates mastery and total time from topic entries', () => {
  const course = {
    allTopics: [
      { id: 'topic-1', state: 'published', interactions: ['i1', 'i2'] },
      { id: 'topic-2', state: 'published', interactions: [] },
      { id: 'topic-3', state: 'draft', interactions: ['i3'] },
    ],
  };
  const progress = {
    mastery: 0,
    totalTimeSpent: 999,
    'topic-1': { scores: { i1: 100 }, timeSpent: 60, lastInteractionAt: '2026-10-01T10:00:00Z' },
    'topic-2': { timeSpent: 30, lastInteractionAt: '2026-10-01T11:00:00Z' },
    'topic-3': { scores: { i3: 100 }, timeSpent: 15 },
  };

  const summary = deriveProgressSummary(progress, course);

  assert.equal(summary.mastery, 75);
  assert.equal(summary.totalTimeSpent, 105);
  assert.equal(summary.completedTopics, 3);
  assert.equal(summary.lastActivityAt, '2026-10-01T11:00:00Z');
});

test('deriveProgressSummary falls back to legacy global values without topic data', () => {
  const summary = deriveProgressSummary({ mastery: 42, totalTimeSpent: 120 }, null);

  assert.equal(summary.mastery, 42);
  assert.equal(summary.totalTimeSpent, 120);
});

test('deriveProgressSummary counts completed exams and submitted projects', () => {
  const progress = {
    'topic-1': { timeSpent: 10, examCompleted: true },
    'topic-2': { timeSpent: 10, projectSubmission: true },
    'topic-3': { timeSpent: 10, examCompleted: true, projectSubmission: true },
    'topic-4': { timeSpent: 10 },
  };

  const summary = deriveProgressSummary(progress, null);

  assert.equal(summary.examCompletedCount, 2);
  assert.equal(summary.projectSubmittedCount, 2);
});

test('deriveProgressSummary yields identical metrics from a full blob and its trimmed equivalent', () => {
  const course = {
    allTopics: [
      { id: 'topic-1', state: 'published', interactions: ['i1', 'i2'] },
      { id: 'topic-2', state: 'published', interactions: [] },
      { id: 'topic-3', state: 'published', interactions: ['i3'] },
    ],
  };

  // Full progress as stored on the enrollment row: raw scores maps, legacy ids, DRA fields, etc.
  const fullProgress = {
    'topic-1': { scores: { i1: 100, i2: 80 }, interactions: ['i1'], timeSpent: 60, lastInteractionAt: '2026-10-01T10:00:00Z', examCompleted: true, mode: 'ai', notes: true },
    'topic-2': { masteryScore: 50, timeSpent: 30, lastInteractionAt: '2026-10-01T11:00:00Z', itemsCompleted: 3, totalItems: 6, draState: 'completed' },
    'topic-3': { scores: { i3: 100 }, timeSpent: 15, projectSubmission: true },
  };

  // Trimmed payload the mastery-overview list emits: scores collapsed to completedCount, the
  // non-overview fields dropped. Must derive to the same numbers.
  const trimmedProgress = {
    'topic-1': { completedCount: 2, timeSpent: 60, lastInteractionAt: '2026-10-01T10:00:00Z', examCompleted: true },
    'topic-2': { completedCount: 0, masteryScore: 50, timeSpent: 30, lastInteractionAt: '2026-10-01T11:00:00Z' },
    'topic-3': { completedCount: 1, timeSpent: 15, projectSubmission: true },
  };

  const fullSummary = deriveProgressSummary(fullProgress, course);
  const trimmedSummary = deriveProgressSummary(trimmedProgress, course);

  assert.deepEqual(trimmedSummary, fullSummary);
  // Pin the expected values so a future change to either path is caught, not just divergence.
  assert.deepEqual(fullSummary, {
    mastery: 83,
    totalTimeSpent: 105,
    completedTopics: 3,
    lastActivityAt: '2026-10-01T11:00:00Z',
    examCompletedCount: 1,
    projectSubmittedCount: 1,
  });
});
