import test from 'node:test';
import assert from 'node:assert/strict';

import { parseDraMarkdown, serializeDraMarkdown, createInitialDraMarkdown, createEmptyDraModel } from './draMarkdown.js';

test('serialize/parse round-trips a populated model', () => {
  const model = {
    title: 'Modernize the Tax System',
    discipline: 'Software Engineering',
    problemType: 'System modernization',
    difficulty: 4,
    practiceMode: true,
    finalMode: true,
    instability: true,
    learningOutcomes: 'Demonstrate systems thinking and evidence-based architectural decision-making.',
  };

  const parsed = parseDraMarkdown(serializeDraMarkdown(model));
  assert.deepEqual(parsed, model);
});

test('parseDraMarkdown migrates the legacy single mode to mode booleans', () => {
  const legacyFinal = parseDraMarkdown('```json\n{"mode": "final"}\n```');
  assert.equal(legacyFinal.practiceMode, false);
  assert.equal(legacyFinal.finalMode, true);
  assert.equal(legacyFinal.mode, undefined);

  const legacyPractice = parseDraMarkdown('```json\n{"mode": "practice"}\n```');
  assert.equal(legacyPractice.practiceMode, true);
  assert.equal(legacyPractice.finalMode, false);
});

test('normalize keeps at least one mode enabled', () => {
  const both = parseDraMarkdown('```json\n{"practiceMode": false, "finalMode": false}\n```');
  assert.equal(both.practiceMode, true);
  assert.equal(both.finalMode, false);
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

  const clamped = parseDraMarkdown('```json\n{"difficulty": 99, "instability": "yes"}\n```');
  assert.equal(clamped.difficulty, 5);
  assert.equal(clamped.instability, true);
});
