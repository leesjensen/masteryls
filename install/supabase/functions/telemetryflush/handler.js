export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Latency histogram bucket boundaries, in milliseconds. MUST match LATENCY_BUCKETS_MS in the client
// (src/observability/observability.js): the client sends per-bucket counts positionally, and these
// are the `explicitBounds` we attach when rebuilding the OTLP histogram.
const LATENCY_BUCKETS_MS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
const CUMULATIVE = 2; // OTLP AggregationTemporality: 2 = CUMULATIVE

function json(body, status) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function otlpAttr(key, value) {
  return { key, value: { stringValue: String(value) } };
}

// A Unix-nanosecond STRING from epoch milliseconds (append zeros rather than multiply, to avoid
// exceeding Number.MAX_SAFE_INTEGER).
function nanoFromMs(ms) {
  return `${Math.round(ms)}000000`;
}

// A freshly-created counter series also gets a synthetic (createdAt, 0) point for roughly this long
// after creation, so Prometheus `increase`/`rate` can see the 0->N jump at the series' birth
// (otherwise the first increments are invisible). It's idempotent (same point each flush) and stops
// once the series is older than this, so established series don't resend an old sample indefinitely.
const COUNTER_BOOTSTRAP_MS = 120000;

/**
 * Build one cumulative OTLP/JSON metrics payload from the stored `client_metric` rows, or null when
 * there is nothing with a non-zero count. The server is the single writer, so no per-session label
 * is needed; each series' start time is its row's createdAt. `nowMs` is the flush wall-clock (ms).
 * Pure; exported for unit testing.
 *
 * Rows: { metric, labels, kind, count, sum, buckets, createdAt }.
 */
export function buildOtlp(appName, rows, nowMs) {
  const timeUnixNano = nanoFromMs(nowMs);
  const byName = new Map(); // metric name -> { kind, dataPoints: [] }
  for (const r of rows || []) {
    if (!r || Number(r.count) <= 0) continue;
    const createdMs = Date.parse(r.createdAt) || nowMs;
    const startTimeUnixNano = nanoFromMs(createdMs);
    const attributes = Object.entries(r.labels || {}).map(([k, v]) => otlpAttr(k, v));
    let entry = byName.get(r.metric);
    if (!entry) {
      entry = { kind: r.kind, dataPoints: [] };
      byName.set(r.metric, entry);
    }
    if (r.kind === 'histogram') {
      entry.dataPoints.push({
        attributes,
        startTimeUnixNano,
        timeUnixNano,
        count: String(r.count),
        sum: Number(r.sum) || 0,
        bucketCounts: (r.buckets || []).map((b) => String(b)),
        explicitBounds: LATENCY_BUCKETS_MS,
      });
    } else {
      const age = nowMs - createdMs;
      if (age >= 0 && age < COUNTER_BOOTSTRAP_MS) {
        entry.dataPoints.push({ attributes, startTimeUnixNano, timeUnixNano: startTimeUnixNano, asInt: '0' });
      }
      entry.dataPoints.push({ attributes, startTimeUnixNano, timeUnixNano, asInt: String(r.count) });
    }
  }

  if (!byName.size) return null;
  const metrics = [];
  for (const [name, { kind, dataPoints }] of byName) {
    if (kind === 'histogram') {
      // No `unit` on purpose: the name already carries `_ms`, and setting unit makes Mimir's
      // OTLP->Prometheus translation append `_milliseconds` (-> an ugly `_ms_milliseconds` name).
      metrics.push({ name, histogram: { aggregationTemporality: CUMULATIVE, dataPoints } });
    } else {
      metrics.push({ name, sum: { aggregationTemporality: CUMULATIVE, isMonotonic: true, dataPoints } });
    }
  }
  return {
    resourceMetrics: [
      {
        resource: { attributes: [otlpAttr('service.name', appName)] },
        scopeMetrics: [{ scope: { name: 'masteryls-client' }, metrics }],
      },
    ],
  };
}

/**
 * Scheduled flush: read the cumulative `client_metric` rows and push them to the Grafana OTLP
 * gateway as a single cumulative payload. Invoked by pg_cron (see schema.sql). The only writer of
 * these series, so Grafana never sees conflicting cumulative values.
 */
export function createTelemetryFlushHandler({ getEnv, readMetrics, fetchFn = fetch, now = () => Date.now() }) {
  return async function handleTelemetryFlush(req) {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    const otlpUrl = getEnv('GRAFANA_OTLP_URL');
    const otlpAuth = getEnv('GRAFANA_OTLP_AUTH');
    if (!otlpUrl || !otlpAuth) {
      return json({ error: 'Telemetry flush is not configured' }, 500);
    }

    let rows;
    try {
      rows = await readMetrics();
    } catch {
      return json({ error: 'Failed to read metrics' }, 500);
    }

    const payload = buildOtlp('masteryls', rows, now());
    if (!payload) {
      return json({ ok: true, pushed: 0 }, 200);
    }

    try {
      const upstream = await fetchFn(otlpUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: otlpAuth },
        body: JSON.stringify(payload),
      });
      if (upstream.ok) {
        return json({ ok: true, pushed: rows.length }, 202);
      }
      let detail = '';
      try {
        detail = (await upstream.text()) || '';
      } catch {
        // ignore
      }
      return json({ ok: false, status: upstream.status, detail: detail.slice(0, 500) }, 502);
    } catch {
      return json({ error: 'Failed to push telemetry' }, 502);
    }
  };
}
