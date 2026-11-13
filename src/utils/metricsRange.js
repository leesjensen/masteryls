// Pure time-range helpers for the Metrics tab. A preset resolves to { startAt, endAt } ISO strings
// relative to `now`; 'custom' is driven by the caller's datetime-local inputs (rangeForPreset → null).

export const DEFAULT_METRICS_RANGE_PRESET = 'last24h';

export const METRICS_RANGE_PRESETS = [
  { id: 'lastHour', label: 'Last hour' },
  { id: 'last24h', label: 'Last 24 hours' },
  { id: 'today', label: 'Today' },
  { id: 'last7d', label: 'Last 7 days' },
  { id: 'custom', label: 'Custom' },
];

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Resolve a preset id to an ISO { startAt, endAt } window ending at `now`. 'today' starts at local
 * midnight. Returns null for 'custom' or an unknown id (the caller supplies those bounds itself).
 */
export function rangeForPreset(preset, now = Date.now()) {
  const endAt = new Date(now).toISOString();
  let start;
  switch (preset) {
    case 'lastHour':
      start = new Date(now - HOUR_MS);
      break;
    case 'last24h':
      start = new Date(now - DAY_MS);
      break;
    case 'last7d':
      start = new Date(now - 7 * DAY_MS);
      break;
    case 'today':
      start = new Date(now);
      start.setHours(0, 0, 0, 0); // local midnight
      break;
    default:
      return null; // custom / unknown — caller provides the bounds
  }
  return { startAt: start.toISOString(), endAt };
}

/**
 * Convert a `datetime-local` value (local wall-clock, no zone) to an ISO string, or null when empty
 * or unparseable. The browser interprets the value in its own timezone, which is what the viewer expects.
 */
export function localInputToIso(value) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/** Compact human duration for the Metrics time chart: "0s", "45s", "12m", "1h 5m", "2h". */
export function formatDurationShort(totalSeconds) {
  const s = Math.max(0, Math.round(Number(totalSeconds) || 0));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}
