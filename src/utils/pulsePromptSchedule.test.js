import test from 'node:test';
import assert from 'node:assert/strict';
import { isWithinScheduleWindow, shouldPromptForPulse } from './pulsePromptSchedule.js';

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
const hoursAgo = (n) => NOW - n * 3600000;

test('shouldPromptForPulse prompts when the last pulse is >= 7 days old and not prompted in 24h', () => {
  assert.equal(shouldPromptForPulse({ lastPulseAt: daysAgo(8), lastPromptedAt: hoursAgo(25), now: NOW }), true);
  assert.equal(shouldPromptForPulse({ lastPulseAt: daysAgo(7), lastPromptedAt: null, now: NOW }), true); // exactly 7 days
  assert.equal(shouldPromptForPulse({ lastPulseAt: null, lastPromptedAt: null, now: NOW }), true); // never pulsed
});

test('shouldPromptForPulse suppresses within 7 days of a pulse or within 24h of a prompt', () => {
  assert.equal(shouldPromptForPulse({ lastPulseAt: daysAgo(3), lastPromptedAt: null, now: NOW }), false); // recent pulse
  assert.equal(shouldPromptForPulse({ lastPulseAt: daysAgo(8), lastPromptedAt: hoursAgo(5), now: NOW }), false); // recently prompted
  assert.equal(shouldPromptForPulse({ lastPulseAt: daysAgo(8), lastPromptedAt: hoursAgo(24), now: NOW }), true); // 24h boundary
});

test('shouldPromptForPulse never prompts when reminders are disabled', () => {
  assert.equal(shouldPromptForPulse({ lastPulseAt: null, lastPromptedAt: null, pulsePromptsDisabled: true, now: NOW }), false);
});

test('shouldPromptForPulse accepts ISO strings for timestamps', () => {
  assert.equal(shouldPromptForPulse({ lastPulseAt: '2026-11-01T12:00:00Z', lastPromptedAt: null, now: NOW }), true); // 10 days
  assert.equal(shouldPromptForPulse({ lastPulseAt: '2026-11-09T12:00:00Z', lastPromptedAt: null, now: NOW }), false); // 2 days
});
