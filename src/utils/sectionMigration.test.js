import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveEnrollmentSection } from './sectionMigration.js';

const sections = [
  { id: 'sec-a', legacyFileId: 'file-a' },
  { id: 'sec-b', legacyFileId: 'file-b' },
];

test('resolveEnrollmentSection maps the learner\'s selected schedule file to its section', () => {
  assert.equal(resolveEnrollmentSection('file-b', sections, 'file-a'), 'sec-b');
});

test('resolveEnrollmentSection falls back to the default file when no selection', () => {
  assert.equal(resolveEnrollmentSection(undefined, sections, 'file-a'), 'sec-a');
  assert.equal(resolveEnrollmentSection(null, sections, 'file-b'), 'sec-b');
});

test('resolveEnrollmentSection falls back to the default when the selection matches nothing', () => {
  assert.equal(resolveEnrollmentSection('file-missing', sections, 'file-a'), 'sec-a');
});

test('resolveEnrollmentSection uses the only section when exactly one exists', () => {
  const one = [{ id: 'sec-solo', legacyFileId: 'file-solo' }];
  assert.equal(resolveEnrollmentSection(undefined, one, undefined), 'sec-solo');
  assert.equal(resolveEnrollmentSection('unknown', one, 'also-unknown'), 'sec-solo');
});

test('resolveEnrollmentSection returns null when ambiguous (multiple sections, no match/default)', () => {
  assert.equal(resolveEnrollmentSection(undefined, sections, undefined), null);
  assert.equal(resolveEnrollmentSection('file-missing', sections, 'default-missing'), null);
});

test('resolveEnrollmentSection returns null when there are no sections', () => {
  assert.equal(resolveEnrollmentSection('file-a', [], 'file-a'), null);
  assert.equal(resolveEnrollmentSection('file-a', null, 'file-a'), null);
});

test('resolveEnrollmentSection ignores sections without a legacyFileId for the file match', () => {
  const mixed = [{ id: 'sec-x' }, { id: 'sec-y', legacyFileId: 'file-y' }];
  assert.equal(resolveEnrollmentSection('file-y', mixed, undefined), 'sec-y');
  // Selected/default both unmatched, more than one section -> ambiguous.
  assert.equal(resolveEnrollmentSection('nope', mixed, 'nope'), null);
});
