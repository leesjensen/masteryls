import test from 'node:test';
import assert from 'node:assert/strict';

import { computeDraScore, countDraItemsCompleted, summarizeDraRun, DRA_ITEM_CHAR_THRESHOLD } from './draScore.js';

function dimension(rating, attributes) {
  return { rating, attributes };
}

test('computeDraScore returns 0 / Beginning for an all-Beginning evaluation', () => {
  const evaluation = {
    process: dimension('Beginning', []),
    competency: dimension('Beginning', []),
    disposition: dimension('Beginning', []),
  };
  const result = computeDraScore(evaluation, 3);
  assert.equal(result.score, 0);
  assert.equal(result.level, 'Beginning');
});

test('computeDraScore applies the process x character weighting', () => {
  // One Proficient (base 75) attribute per dimension, no evidence.
  // attribute supportedScore = 75 * (0.5 + 0.5*0) = 37.5 -> each dimension score 37.5
  // character = (37.5+37.5)/2 = 37.5 -> processMultiplier = 0.5 + 0.5*0.375 = 0.6875
  // raw = 37.5 * 0.6875 = 25.78 -> rounded 26, level Emerging (>= 20)
  const dim = () => dimension('Proficient', [{ name: 'A', rating: 'Proficient', evidence: [] }]);
  const result = computeDraScore({ process: dim(), competency: dim(), disposition: dim() }, 3);
  assert.equal(result.score, 26);
  assert.equal(result.level, 'Emerging');
});

test('computeDraScore returns null without an evaluation', () => {
  assert.equal(computeDraScore(null, 3), null);
});

test('countDraItemsCompleted counts stages past the character threshold (trimmed, strict)', () => {
  const notes = {
    Frame: 'x'.repeat(DRA_ITEM_CHAR_THRESHOLD + 1), // 301 -> counts
    Research: 'too short',                            // no
    Model: '   ' + 'y'.repeat(DRA_ITEM_CHAR_THRESHOLD + 5) + '   ', // trims to 305 -> counts
    Act: 'z'.repeat(DRA_ITEM_CHAR_THRESHOLD),         // exactly 300 -> no (strict >)
  };
  assert.equal(countDraItemsCompleted(notes), 2);
});

test('summarizeDraRun rolls up score and items for a run', () => {
  const run = {
    difficulty: 3,
    stages: [{ stage: 'Frame' }, { stage: 'Research' }, { stage: 'Model' }],
    stageNotes: { Frame: 'a'.repeat(400), Research: 'b'.repeat(400), Model: 'short' },
    evaluation: null,
  };
  const summary = summarizeDraRun(run, 3);
  assert.equal(summary.totalItems, 3);
  assert.equal(summary.itemsCompleted, 2);
  assert.equal(summary.score, null); // no evaluation yet
});
