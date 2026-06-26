import test from 'node:test';
import assert from 'node:assert/strict';

import { parseDraMarkdown, serializeDraMarkdown, createInitialDraMarkdown, createEmptyDraModel } from './draMarkdown.js';

test('serialize/parse round-trips a populated model', () => {
  const model = {
    title: 'Modernize the Tax System',
    discipline: 'Software Engineering',
    problemType: 'System modernization',
    difficulty: 4,
    mode: 'final',
    instability: true,
    learningOutcomes: 'Demonstrate systems thinking and evidence-based architectural decision-making.',
  };

  const parsed = parseDraMarkdown(serializeDraMarkdown(model));
  assert.deepEqual(parsed, model);
});

test('createInitialDraMarkdown parses back to defaults with the given title', () => {
  const markdown = createInitialDraMarkdown('My Assessment');
  const parsed = parseDraMarkdown(markdown);
  assert.deepEqual(parsed, { ...createEmptyDraModel('My Assessment') });
});

test('parseDraMarkdown returns defaults when no definition fence is present', () => {
  assert.deepEqual(parseDraMarkdown('# Just a heading\n\nSome text.'), createEmptyDraModel());
  assert.deepEqual(parseDraMarkdown(''), createEmptyDraModel());
});

test('parseDraMarkdown tolerates malformed json and clamps invalid fields', () => {
  assert.deepEqual(parseDraMarkdown('```json\n{not json}\n```'), createEmptyDraModel());

  const clamped = parseDraMarkdown('```json\n{"difficulty": 99, "mode": "bogus", "instability": "yes"}\n```');
  assert.equal(clamped.difficulty, 5);
  assert.equal(clamped.mode, 'practice');
  assert.equal(clamped.instability, true);
});
