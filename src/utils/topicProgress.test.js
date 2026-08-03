import assert from 'node:assert/strict';
import test from 'node:test';

import { completedInteractionIds } from './topicProgress.js';

test('completedInteractionIds returns [] for missing or empty progress', () => {
  assert.deepEqual(completedInteractionIds(undefined), []);
  assert.deepEqual(completedInteractionIds(null), []);
  assert.deepEqual(completedInteractionIds({}), []);
  assert.deepEqual(completedInteractionIds({ scores: {}, interactions: [] }), []);
});

test('completedInteractionIds reads the scores map keys', () => {
  assert.deepEqual(completedInteractionIds({ scores: { a: 92, b: null } }), ['a', 'b']);
});

test('completedInteractionIds reads a legacy interactions array when there is no scores map', () => {
  assert.deepEqual(completedInteractionIds({ interactions: ['a', 'b'] }), ['a', 'b']);
});

test('completedInteractionIds unions and dedupes scores keys with legacy interactions', () => {
  const result = completedInteractionIds({ scores: { a: 92, b: null }, interactions: ['b', 'c'] });
  assert.deepEqual([...result].sort(), ['a', 'b', 'c']);
});

test('completedInteractionIds does not treat a null score value as absent (key still counts)', () => {
  assert.deepEqual(completedInteractionIds({ scores: { a: null } }), ['a']);
});
