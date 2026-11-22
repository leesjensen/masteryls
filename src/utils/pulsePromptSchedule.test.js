import test from 'node:test';
import assert from 'node:assert/strict';
import { arePulseRemindersDisabled, isWithinScheduleWindow, shouldPromptForPulse } from './pulsePromptSchedule.js';

test('pulse reminder defaults are off for course overseers and on for other users', () => {
  const overseer = { canOverseeCourse: (courseId) => courseId === 'course-1' };
  const learner = { canOverseeCourse: () => false };
  assert.equal(arePulseRemindersDisabled({ settings: {} }, overseer, 'course-1'), true);
  assert.equal(arePulseRemindersDisabled({ settings: {} }, learner, 'course-1'), false);
  assert.equal(arePulseRemindersDisabled({ settings: {} }, overseer, 'course-2'), false);
});

test('an explicit pulse reminder preference overrides the role default', () => {
  const overseer = { canOverseeCourse: () => true };
  const learner = { canOverseeCourse: () => false };
  assert.equal(arePulseRemindersDisabled({ settings: { pulsePromptsDisabled: false } }, overseer, 'course-1'), false);
  assert.equal(arePulseRemindersDisabled({ settings: { pulsePromptsDisabled: true } }, learner, 'course-1'), true);
});

test('isWithinScheduleWindow requires a dated window that includes today', () => {
  assert.equal(isWithinScheduleWindow({ startDate: '2026-09-01', endDate: '2026-12-18' }, '2026-11-11'), true);
  assert.equal(isWithinScheduleWindow({ startDate: '2026-09-01', endDate: '2026-12-18' }, '2026-08-31'), false); // before start
  assert.equal(isWithinScheduleWindow({ startDate: '2026-09-01', endDate: '2026-12-18' }, '2026-12-19'), false); // after end
  assert.equal(isWithinScheduleWindow({ startDate: '2026-09-01', endDate: '2026-09-01' }, '2026-09-01'), true); // boundary inclusive
  assert.equal(isWithinScheduleWindow({ startDate: '2026-09-01' }, '2026-10-01'), true); // open-ended end
  assert.equal(isWithinScheduleWindow({ endDate: '2026-12-18' }, '2026-10-01'), true); // open-ended start
});

test('isWithinScheduleWindow returns false when there is no dated window', () => {
  assert.equal(isWithinScheduleWindow({ startDate: null, endDate: null }, '2026-11-11'), false);
  assert.equal(isWithinScheduleWindow(null, '2026-11-11'), false);
  assert.equal(isWithinScheduleWindow(undefined, '2026-11-11'), false);
});

const NOW = new Date('2026-11-11T12:00:00Z').getTime();
const daysAgo = (n) => NOW - n * 86400000;
const hoursFromNow = (n) => NOW + n * 3600000;

test('shouldPromptForPulse prompts when the last pulse is >= 7 days old and the cooldown has elapsed', () => {
  assert.equal(shouldPromptForPulse({ lastPulseAt: daysAgo(8), nextPromptAt: null, now: NOW }), true);
  assert.equal(shouldPromptForPulse({ lastPulseAt: daysAgo(7), nextPromptAt: null, now: NOW }), true); // exactly 7 days
  assert.equal(shouldPromptForPulse({ lastPulseAt: null, nextPromptAt: null, now: NOW }), true); // never pulsed
  assert.equal(shouldPromptForPulse({ lastPulseAt: daysAgo(8), nextPromptAt: hoursFromNow(1), now: NOW }), false); // dismissed recently
  assert.equal(shouldPromptForPulse({ lastPulseAt: daysAgo(8), nextPromptAt: NOW, now: NOW }), true); // cooldown boundary
});

test('shouldPromptForPulse suppresses within 7 days of a pulse', () => {
  assert.equal(shouldPromptForPulse({ lastPulseAt: daysAgo(3), lastPromptedAt: null, now: NOW }), false); // recent pulse
});

test('shouldPromptForPulse never prompts when reminders are disabled', () => {
  assert.equal(shouldPromptForPulse({ lastPulseAt: null, nextPromptAt: null, pulsePromptsDisabled: true, now: NOW }), false);
});

test('shouldPromptForPulse accepts ISO strings for timestamps', () => {
  assert.equal(shouldPromptForPulse({ lastPulseAt: '2026-11-01T12:00:00Z', nextPromptAt: null, now: NOW }), true); // 10 days
  assert.equal(shouldPromptForPulse({ lastPulseAt: '2026-11-09T12:00:00Z', nextPromptAt: null, now: NOW }), false); // 2 days
});
