import config from '../../config.js';

// Client-side observability for MasteryLS. Two independent, config-gated sinks, both following the
// same shape: the browser BUFFERS in memory and flushes batches to a Supabase edge function, which
// holds the Grafana credentials server-side and forwards to Grafana Cloud (the Loki/OTLP ingest
// endpoints have no browser CORS anyway). No third-party SDK.
//
//   - LOGS  -> Grafana Loki, via the `logpush` edge function. Tells the whole story: our action
//              events (enroll/unenroll/interaction_submit/topic_view/login), instrumented call
//              failures, and uncaught JS errors / unhandled rejections (captured via window hooks).
//              Entries accumulate in a bounded buffer and flush on a timer, on a batch-size trigger,
//              and on page hide - batched, never one POST per event. Tagged with user id + coarse
//              role only (no names/emails).
//   - METRICS -> Grafana Mimir, via SERVER-SIDE aggregation. The client accumulates DELTAS and POSTs
//              them to the `telemetry` edge function, which folds them into a Postgres table; the
//              scheduled `telemetryflush` function pushes ONE cumulative OTLP payload to Grafana.
//              Server is the single writer, so metrics carry only aggregate labels (op/status/result)
//              - no per-session id - and cardinality is fixed regardless of how many browsers run.
//
// Enable from config.js:
//   observability: {
//     enabled: true,
//     appName: 'masteryls',
//     logs:    { enabled: true },   // batched to the `logpush` edge function -> Loki
//     metrics: { enabled: true },   // deltas to the `telemetry` edge function -> Mimir
//   }
// Grafana credentials live in the edge functions' env (LOKI_URL/_AUTH, GRAFANA_OTLP_URL/_AUTH), not
// here. Every export is a safe no-op until the matching sink is initialized, so the app behaves
// identically with observability disabled (the default).

let logs = null; // Logs buffer/state (see initLogs), or null.
let metrics = null; // Metrics pusher state (see initMetrics), or null.

// Explicit latency histogram bucket boundaries, in milliseconds (`le` buckets).
const LATENCY_BUCKETS_MS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
const LOGIN_COUNTER_METRIC = 'masteryls_client_login_total';
const FLUSH_INTERVAL_MS = 45000;

// Log buffering: flush at most every LOG_FLUSH_INTERVAL_MS, or immediately once LOG_BATCH_MAX entries
// are queued; LOG_BUFFER_MAX caps memory if flushes keep failing; stacks are truncated.
const LOG_FLUSH_INTERVAL_MS = 15000;
const LOG_BATCH_MAX = 25;
const LOG_BUFFER_MAX = 200;
const MAX_STACK_CHARS = 2000;

function settings() {
  return config?.observability || {};
}

function isActive() {
  return logs !== null || metrics !== null;
}

// A coarse, non-PII role tag for grouping (no names or emails leave the app).
function roleOf(user) {
  if (!user) return 'anonymous';
  try {
    if (user.isRoot?.()) return 'root';
    if (user.isEditor?.()) return 'editor';
    if (user.isMentor?.()) return 'mentor';
  } catch {
    // fall through to learner
  }
  return 'learner';
}

// Drop null/undefined attrs; keep other values native for JSON log lines.
function cleanAttrs(attrs) {
  const out = {};
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined) continue;
    out[key] = value;
  }
  return out;
}

function nowMs() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
}

// Current wall-clock time as a Unix-nanosecond STRING (Loki timestamps). Append zeros rather than
// multiply, so we don't exceed Number.MAX_SAFE_INTEGER.
function nanoStr() {
  return `${Date.now()}000000`;
}

// Classify an HTTP status into the metric `status` label. Non-numeric/missing -> 'error' (treated
// as a transport failure with no HTTP response). Pure; exported for unit testing.
export function httpClass(status) {
  if (typeof status !== 'number' || !Number.isFinite(status)) return 'error';
  if (status >= 500) return '5xx';
  if (status >= 400) return '4xx';
  return 'ok';
}

// ----------------------------------------------------------------------------------------------
// Logs sink (buffered -> `logpush` edge function -> Loki)
// ----------------------------------------------------------------------------------------------

function initLogs(cfg) {
  const sb = config?.supabase;
  if (!cfg.logs?.enabled || !sb?.url || !sb?.key) return null;
  const state = {
    url: `${sb.url}/functions/v1/logpush`,
    headers: { apikey: sb.key, Authorization: `Bearer ${sb.key}` },
    buffer: [], // [{ ts, level, line }]
    user: null, // { id, role } | null
  };
  logs = state;
  try {
    setInterval(() => flushLogs(), LOG_FLUSH_INTERVAL_MS);
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flushLogs();
      });
    }
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('pagehide', () => flushLogs());
      // Capture uncaught errors + unhandled promise rejections as error-level log entries.
      window.addEventListener('error', (e) => {
        pushLog('error', 'exception', { message: e?.message, source: e?.filename, line: e?.lineno, column: e?.colno, stack: truncate(e?.error?.stack) });
      });
      window.addEventListener('unhandledrejection', (e) => {
        const reason = e?.reason;
        pushLog('error', 'unhandledrejection', { message: reason?.message || String(reason), stack: truncate(reason?.stack) });
      });
    }
  } catch {
    // listeners/timer are best-effort
  }
  return state;
}

function truncate(stack) {
  return typeof stack === 'string' ? stack.slice(0, MAX_STACK_CHARS) : undefined;
}

// Set/clear the user tag applied to subsequent log entries (id + coarse role; no names/emails).
export function setObservabilityUser(user) {
  if (!logs) return;
  logs.user = user?.id ? { id: user.id, role: roleOf(user) } : null;
}

// Build one JSON log line: event_name + current user tag + cleaned attributes.
function logLine(event, attrs) {
  const base = { event_name: event };
  if (logs?.user) {
    base.user_id = logs.user.id;
    base.role = logs.user.role;
  }
  return JSON.stringify({ ...base, ...cleanAttrs(attrs) });
}

// Queue a log entry. Flushes immediately at the batch threshold; caps the buffer so a failing
// endpoint can't grow memory without bound. No-op when logs are off.
function pushLog(level, event, attrs) {
  if (!logs) return;
  logs.buffer.push({ ts: nanoStr(), level: level === 'error' ? 'error' : 'info', line: logLine(event, attrs) });
  if (logs.buffer.length >= LOG_BATCH_MAX) {
    flushLogs();
  } else if (logs.buffer.length > LOG_BUFFER_MAX) {
    logs.buffer.splice(0, logs.buffer.length - LOG_BUFFER_MAX);
  }
}

// Drain the buffer and POST the batch to the `logpush` edge function (which formats + forwards to
// Loki). keepalive lets an in-flight flush survive page unload.
function flushLogs() {
  if (!logs || !logs.buffer.length) return;
  const entries = logs.buffer.splice(0, logs.buffer.length);
  try {
    fetch(logs.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...logs.headers },
      body: JSON.stringify({ entries }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore - telemetry must never break the app
  }
}

// Log an important user action, e.g. logAction('enroll', { courseId }). No-op when logs are off.
export function logAction(name, attributes = {}) {
  pushLog('info', name, attributes);
}

// ----------------------------------------------------------------------------------------------
// Metrics sink (hand-rolled OTLP/JSON -> Mimir)
// ----------------------------------------------------------------------------------------------

function initMetrics(cfg) {
  // Metrics are relayed through the Supabase `telemetry` edge function (the Grafana OTLP gateway has
  // no browser CORS support, and the relay keeps the Grafana write token server-side). We reach it
  // with the already-public Supabase anon key, so no extra client secret is introduced.
  const sb = config?.supabase;
  if (!cfg.metrics?.enabled || !sb?.url || !sb?.key) return null;
  const state = {
    url: `${sb.url}/functions/v1/telemetry`,
    headers: { apikey: sb.key, Authorization: `Bearer ${sb.key}` },
    histograms: new Map(), // key `op\0status` -> { op, status, count, sum, buckets[] }
    counters: new Map(), // key `metric\0labels` -> { metric, labels, value }
  };
  try {
    setInterval(() => flushMetrics(), FLUSH_INTERVAL_MS);
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flushMetrics();
      });
    }
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('pagehide', () => flushMetrics());
    }
  } catch {
    // ignore - timers/listeners are best-effort
  }
  return state;
}

// Record one instrumented call into the latency histogram. No-op when metrics are off.
function recordCall(op, status, durationMs) {
  if (!metrics) return;
  const key = `${op}\u0000${status}`;
  let h = metrics.histograms.get(key);
  if (!h) {
    h = { op, status, count: 0, sum: 0, buckets: new Array(LATENCY_BUCKETS_MS.length + 1).fill(0) };
    metrics.histograms.set(key, h);
  }
  h.count += 1;
  h.sum += durationMs;
  let i = 0;
  while (i < LATENCY_BUCKETS_MS.length && durationMs > LATENCY_BUCKETS_MS[i]) i += 1;
  h.buckets[i] += 1;
}

// Increment a labelled counter (delta). Generic over metric name + label set. No-op when off.
function recordCounter(metric, labels) {
  if (!metrics) return;
  const norm = cleanAttrs(labels);
  const key = `${metric}\u0000` + Object.keys(norm).sort().map((k) => `${k}=${norm[k]}`).join('\u0001');
  let c = metrics.counters.get(key);
  if (!c) {
    c = { metric, labels: norm, value: 0 };
    metrics.counters.set(key, c);
  }
  c.value += 1;
}

// Record a login outcome. Emits the counter metric and a `login` log event. On success the caller
// passes the just-authenticated user so the event carries user_id + role (at this point the global
// user tag isn't set yet). `extra` adds event fields to the LOG only (e.g. the attempted email on a
// failure) - never to the metric, whose only label stays `result` (no PII / no cardinality blowup).
export function recordLogin(result, user, extra = {}) {
  const value = result === 'success' ? 'success' : 'failure';
  const attrs = { result: value, ...cleanAttrs(extra) };
  if (user?.id) {
    attrs.user_id = user.id;
    attrs.role = roleOf(user);
  }
  logAction('login', attrs);
  recordCounter(LOGIN_COUNTER_METRIC, { result: value });
}

// Course/topic engagement counters. Labels are the course/topic NAMES (bounded cardinality; the
// server caps distinct series). Titles live only on these metrics, not in log lines. No-op when off.
export function recordTopicView(course, topic) {
  if (!course) return;
  recordCounter('masteryls_client_topic_views_total', topic ? { course, topic } : { course });
}
export function recordInteraction(course, topic) {
  if (!course) return;
  recordCounter('masteryls_client_interactions_total', topic ? { course, topic } : { course });
}
export function recordEnrollment(course) {
  if (!course) return;
  recordCounter('masteryls_client_enrollments_total', { course });
}
// Pulse generation. `target` = learner|section|course, `type` = analysis|feedback (both low
// cardinality). Labelled by course NAME like the other engagement counters. No-op when off.
export function recordPulse(course, { target, type } = {}) {
  if (!course) return;
  const labels = { course };
  if (target) labels.target = target;
  if (type) labels.type = type;
  recordCounter('masteryls_client_pulses_total', labels);
}

// Build the compact DELTA payload the edge function ingests, or null when there is nothing to send.
// Shape: { calls: [{ op, status, count, sum, buckets[] }], counters: [{ metric, labels, count }] }.
// These are increments since the last flush (not cumulative) - the server accumulates them. Pure.
export function buildDeltaPayload(histograms, counters) {
  const calls = histograms
    .filter((h) => h.count > 0)
    .map((h) => ({ op: h.op, status: h.status, count: h.count, sum: h.sum, buckets: h.buckets }));
  const counterDeltas = counters.filter((c) => c.value > 0).map((c) => ({ metric: c.metric, labels: c.labels, count: c.value }));
  if (!calls.length && !counterDeltas.length) return null;
  return { calls, counters: counterDeltas };
}

// Snapshot the accumulated deltas, reset them, and POST to the `telemetry` ingest function. Delta
// semantics: clearing immediately means a failed POST drops at most one window (acceptable for
// metrics); keepalive lets an in-flight flush survive page unload.
function flushMetrics() {
  if (!metrics) return;
  const payload = buildDeltaPayload([...metrics.histograms.values()], [...metrics.counters.values()]);
  metrics.histograms.clear();
  metrics.counters.clear();

  if (!payload) return;
  try {
    fetch(metrics.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...metrics.headers },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore - telemetry must never break the app
  }
}

// ----------------------------------------------------------------------------------------------
// Shared helper + bootstrap
// ----------------------------------------------------------------------------------------------

const defaultClassify = (result, error) => (error ? 'error' : 'ok');

// Wrap an async operation to record its latency + status into the call histogram (metrics) and,
// on failure, an error event (logs) - WITHOUT altering the resolved value or swallowing the
// rejection. `classify(result, error)` maps the outcome to a status label; the default is ok/error,
// while HTTP callers pass one that reads a 4xx/5xx status code. No-op (just awaits fn) when both
// sinks are off.
export async function instrument(op, context, fn, classify = defaultClassify) {
  if (!isActive()) {
    return fn();
  }
  const start = nowMs();
  try {
    const result = await fn();
    recordCall(op, classify(result, null), Math.round(nowMs() - start));
    return result;
  } catch (error) {
    const status = classify(null, error);
    recordCall(op, status, Math.round(nowMs() - start));
    pushLog('error', `${op}_error`, { ...context, status, message: error?.message || String(error) });
    throw error;
  }
}

// Initialize observability once at bootstrap. No-op unless enabled; each sink activates only when
// its own flag is set (and Supabase config is present). Never throws - telemetry must not break the app.
export function initObservability(user) {
  const cfg = settings();
  if (!cfg.enabled) return;
  if (!metrics) metrics = initMetrics(cfg);
  if (!logs) initLogs(cfg);
  setObservabilityUser(user);
}
