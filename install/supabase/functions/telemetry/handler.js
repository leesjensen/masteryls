export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cap ingest payloads so a single request can't carry an unbounded batch.
const MAX_BODY_BYTES = 256 * 1024;

// This endpoint is reachable with the public anon key, and label values flow into stored series, so
// op/status/result are strict allowlists - this is what bounds metric cardinality (an attacker can't
// invent new label values). ALLOWED_OPS must track the instrument() op strings in src/service/
// service.ts (edge:<fn> + github); an unlisted op is dropped (fail-safe), not stored.
const ALLOWED_OPS = new Set([
  'edge:loginas',
  'edge:progressrecord',
  'edge:canvas',
  'edge:canvasgradebook',
  'edge:masteryoverview',
  'edge:urlvalidator',
  'edge:githubgrade',
  'edge:githubsnapshot',
  'edge:gemini',
  'github',
]);
const ALLOWED_STATUS = new Set(['ok', '4xx', '5xx', 'error']);
const ALLOWED_RESULT = new Set(['success', 'failure']);
const MAX_BUCKETS = 12;

// Counter metric names are a strict allowlist (an unlisted metric is dropped). Label KEYS are also
// allowlisted; values are free-form (course/topic names) but length-capped, and the RPC caps the
// number of distinct series per metric so a malicious client can't explode Prometheus cardinality.
const ALLOWED_COUNTER_METRICS = new Set([
  'masteryls_client_login_total',
  'masteryls_client_topic_views_total',
  'masteryls_client_interactions_total',
  'masteryls_client_enrollments_total',
]);
const ALLOWED_LABEL_KEYS = new Set(['result', 'course', 'topic']);
const MAX_LABEL_LEN = 160;

function json(body, status) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function nonNegInt(value) {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function nonNegNum(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// Keep only well-formed entries with allowlisted labels and sane numbers. Everything else is dropped.
export function sanitizeDelta(payload) {
  const calls = [];
  for (const c of Array.isArray(payload?.calls) ? payload.calls : []) {
    if (!ALLOWED_OPS.has(c?.op) || !ALLOWED_STATUS.has(c?.status)) continue;
    const count = nonNegInt(c?.count);
    if (count <= 0) continue;
    const buckets = Array.isArray(c?.buckets) ? c.buckets.slice(0, MAX_BUCKETS).map(nonNegInt) : [];
    calls.push({ op: c.op, status: c.status, count, sum: nonNegNum(c?.sum), buckets });
  }
  const counters = [];
  for (const c of Array.isArray(payload?.counters) ? payload.counters : []) {
    if (!ALLOWED_COUNTER_METRICS.has(c?.metric)) continue;
    const count = nonNegInt(c?.count);
    if (count <= 0) continue;
    const labels = {};
    for (const [k, v] of Object.entries(c?.labels || {})) {
      if (!ALLOWED_LABEL_KEYS.has(k)) continue;
      const val = String(v).slice(0, MAX_LABEL_LEN);
      if (val) labels[k] = val;
    }
    // Shape rules: login must carry a valid result; engagement metrics must carry a course.
    if (c.metric === 'masteryls_client_login_total') {
      if (!ALLOWED_RESULT.has(labels.result)) continue;
    } else if (!labels.course) {
      continue;
    }
    counters.push({ metric: c.metric, labels, count });
  }
  return { calls, counters };
}

/**
 * Telemetry ingest: accepts a compact DELTA payload from the browser
 *   { calls: [{ op, status, count, sum, buckets[] }], counters: [{ metric, labels, count }] }
 * and folds it into the cumulative `client_metric` table via `recordMetrics` (the
 * record_client_metrics RPC). A separate scheduled function exports the totals to Grafana, so this
 * endpoint never talks to Grafana and holds no Grafana credentials.
 */
export function createTelemetryHandler({ recordMetrics }) {
  return async function handleTelemetry(req) {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }
    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    let payload;
    try {
      payload = await req.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    if (JSON.stringify(payload).length > MAX_BODY_BYTES) {
      return json({ error: 'Payload too large' }, 413);
    }
    const { calls, counters } = sanitizeDelta(payload);
    if (!calls.length && !counters.length) {
      return json({ error: 'Expected a metrics delta payload' }, 400);
    }

    try {
      await recordMetrics(calls, counters);
      return json({ ok: true }, 202);
    } catch (err) {
      return json({ error: 'Failed to record telemetry', detail: String(err?.message || err).slice(0, 500) }, 502);
    }
  };
}
