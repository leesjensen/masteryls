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
