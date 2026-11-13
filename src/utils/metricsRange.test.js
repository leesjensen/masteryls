import test from 'node:test';
import assert from 'node:assert/strict';
import { rangeForPreset, localInputToIso, formatDurationShort, DEFAULT_METRICS_RANGE_PRESET, METRICS_RANGE_PRESETS } from './metricsRange.js';

const NOW = Date.parse('2026-11-13T15:30:00.000Z');

test('lastHour spans the 60 minutes ending now', () => {
  const { startAt, endAt } = rangeForPreset('lastHour', NOW);
  assert.equal(endAt, new Date(NOW).toISOString());
  assert.equal(startAt, new Date(NOW - 60 * 60 * 1000).toISOString());
});

test('last24h spans the day ending now', () => {
  const { startAt, endAt } = rangeForPreset('last24h', NOW);
  assert.equal(startAt, new Date(NOW - 24 * 60 * 60 * 1000).toISOString());
  assert.equal(endAt, new Date(NOW).toISOString());
});

test('last7d spans the week ending now', () => {
  const { startAt } = rangeForPreset('last7d', NOW);
  assert.equal(startAt, new Date(NOW - 7 * 24 * 60 * 60 * 1000).toISOString());
});

test('today starts at local midnight and ends now', () => {
  const { startAt, endAt } = rangeForPreset('today', NOW);
  const midnight = new Date(NOW);
  midnight.setHours(0, 0, 0, 0);
  assert.equal(startAt, midnight.toISOString());
  assert.equal(endAt, new Date(NOW).toISOString());
  // Local midnight is at or before now.
  assert.ok(Date.parse(startAt) <= NOW);
});

test('custom / unknown presets return null (caller supplies bounds)', () => {
  assert.equal(rangeForPreset('custom', NOW), null);
  assert.equal(rangeForPreset('nope', NOW), null);
});

test('localInputToIso converts a datetime-local value and is null-safe', () => {
  assert.equal(localInputToIso(''), null);
  assert.equal(localInputToIso(null), null);
  assert.equal(localInputToIso('not-a-date'), null);
  // A parseable local value round-trips to a valid ISO instant.
  const iso = localInputToIso('2026-11-13T08:00');
  assert.ok(iso && !Number.isNaN(Date.parse(iso)));
});

test('the default preset is one of the offered presets', () => {
  assert.ok(METRICS_RANGE_PRESETS.some((p) => p.id === DEFAULT_METRICS_RANGE_PRESET));
});

test('formatDurationShort renders compact durations', () => {
  assert.equal(formatDurationShort(0), '0s');
  assert.equal(formatDurationShort(45), '45s');
  assert.equal(formatDurationShort(60), '1m');
  assert.equal(formatDurationShort(725), '12m');
  assert.equal(formatDurationShort(3600), '1h');
  assert.equal(formatDurationShort(3900), '1h 5m');
  assert.equal(formatDurationShort(-5), '0s');
});
