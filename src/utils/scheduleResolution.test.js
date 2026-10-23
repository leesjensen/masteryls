import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveLearnerSchedule } from './scheduleResolution.js';

const sections = [
  { id: 'sec-a', scheduleId: 'sch-a' },
  { id: 'sec-b', scheduleId: 'sch-b' },
];
const schedules = [
  { id: 'sch-a', contentPath: 'https://raw/.../a.md' },
  { id: 'sch-b', contentPath: 'https://raw/.../b.md' },
];
const legacyFiles = [
  { id: 'file-a', path: 'https://raw/.../a.md', default: true },
  { id: 'file-b', path: 'https://raw/.../b.md' },
];

test('prefers the section schedule when the enrollment has a sectionId', () => {
  const r = resolveLearnerSchedule({ sectionId: 'sec-b', sections, schedules, legacyFiles, selectedScheduleFileId: 'file-a' });
  assert.equal(r.source, 'section');
  assert.equal(r.scheduleId, 'sch-b');
  assert.equal(r.contentPath, 'https://raw/.../b.md');
});

test('falls back to legacy selected file when there is no sectionId', () => {
  const r = resolveLearnerSchedule({ sectionId: null, sections, schedules, legacyFiles, selectedScheduleFileId: 'file-b' });
  assert.equal(r.source, 'legacy');
  assert.equal(r.legacyFile.id, 'file-b');
  assert.equal(r.contentPath, 'https://raw/.../b.md');
});

test('falls back to legacy default when no selection', () => {
  const r = resolveLearnerSchedule({ sectionId: null, sections, schedules, legacyFiles });
  assert.equal(r.source, 'legacy');
  assert.equal(r.legacyFile.id, 'file-a'); // default
});

test('falls back to legacy when the section exists but its schedule was not loaded', () => {
  const r = resolveLearnerSchedule({ sectionId: 'sec-a', sections, schedules: [], legacyFiles, selectedScheduleFileId: 'file-b' });
  assert.equal(r.source, 'legacy');
  assert.equal(r.legacyFile.id, 'file-b');
});

test('falls back to legacy when sectionId matches no loaded section', () => {
  const r = resolveLearnerSchedule({ sectionId: 'sec-missing', sections, schedules, legacyFiles });
  assert.equal(r.source, 'legacy');
  assert.equal(r.legacyFile.id, 'file-a');
});

test('returns null for a schedule-less course (no section schedule, no legacy files)', () => {
  assert.equal(resolveLearnerSchedule({ sectionId: null, sections: [], schedules: [], legacyFiles: [] }), null);
  assert.equal(resolveLearnerSchedule({ sectionId: 'sec-a', sections, schedules, legacyFiles: [] }).source, 'section');
});

test('section without a scheduleId falls through to legacy', () => {
  const r = resolveLearnerSchedule({ sectionId: 'sec-x', sections: [{ id: 'sec-x', scheduleId: null }], schedules, legacyFiles });
  assert.equal(r.source, 'legacy');
});
