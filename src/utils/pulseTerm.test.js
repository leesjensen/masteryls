import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLearnerPulseTermId } from './pulseTerm.js';

const sections = [
  { id: 's1', termId: 't1' },
  { id: 's2', termId: 't2' },
  { id: 's3', termId: null },
];

test('resolves the enrollment section term for a learner', () => {
  assert.equal(resolveLearnerPulseTermId({ sectionId: 's2' }, sections), 't2');
});

test('coerces ids so numeric/string section ids still match', () => {
  assert.equal(resolveLearnerPulseTermId({ sectionId: 1 }, [{ id: '1', termId: 't9' }]), 't9');
});

test('returns empty when the learner has no section', () => {
  assert.equal(resolveLearnerPulseTermId({ sectionId: null }, sections), '');
  assert.equal(resolveLearnerPulseTermId({}, sections), '');
  assert.equal(resolveLearnerPulseTermId(null, sections), '');
});

test('returns empty when the section has no term, or is unknown', () => {
  assert.equal(resolveLearnerPulseTermId({ sectionId: 's3' }, sections), '');
  assert.equal(resolveLearnerPulseTermId({ sectionId: 'missing' }, sections), '');
  assert.equal(resolveLearnerPulseTermId({ sectionId: 's1' }, []), '');
  assert.equal(resolveLearnerPulseTermId({ sectionId: 's1' }, undefined), '');
});
