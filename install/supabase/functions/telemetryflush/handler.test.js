import test from 'node:test';
import assert from 'node:assert/strict';
import { createTelemetryFlushHandler, buildOtlp } from './handler.js';

const ENV = { GRAFANA_OTLP_URL: 'https://otlp.example/v1/metrics', GRAFANA_OTLP_AUTH: 'Basic abc123' };
const getEnv = (env) => (key) => env[key];

const rows = [
  {
    metric: 'masteryls_client_call_duration_ms',
    labels: { op: 'edge:gemini', status: 'ok' },
    kind: 'histogram',
    count: 2,
    sum: 150,
    buckets: [0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    createdAt: '2026-11-04T00:00:00.000Z',
  },
  {
    metric: 'masteryls_client_login_total',
    labels: { result: 'success' },
    kind: 'counter',
    count: 3,
    sum: 0,
    buckets: null,
    createdAt: '2026-11-04T00:00:00.000Z',
  },
];

// --- buildOtlp (pure) ---

function nanoOf(iso) {
  return `${Date.parse(iso)}000000`;
}

test('buildOtlp returns null when there are no non-zero rows', () => {
  assert.equal(buildOtlp('masteryls', [], 1), null);
  assert.equal(buildOtlp('masteryls', [{ metric: 'm', labels: {}, kind: 'counter', count: 0 }], 1), null);
});

test('buildOtlp emits a cumulative histogram + counter (old series = no bootstrap point)', () => {
  const nowMs = Date.parse('2026-11-04T00:00:00.000Z') + 600000; // 10 min after createdAt
  const payload = buildOtlp('masteryls', rows, nowMs);
  const scope = payload.resourceMetrics[0].scopeMetrics[0];
  assert.equal(payload.resourceMetrics[0].resource.attributes[0].value.stringValue, 'masteryls');
  // No per-session instance attribute (server-side aggregation).
  assert.equal(payload.resourceMetrics[0].resource.attributes.length, 1);

  const hist = scope.metrics.find((m) => m.name === 'masteryls_client_call_duration_ms');
  assert.equal(hist.histogram.aggregationTemporality, 2); // CUMULATIVE
  const hp = hist.histogram.dataPoints[0];
  assert.equal(hp.count, '2');
  assert.equal(hp.sum, 150);
  assert.equal(hp.bucketCounts.length, hp.explicitBounds.length + 1);
  assert.deepEqual(
    hp.attributes.map((a) => [a.key, a.value.stringValue]),
    [['op', 'edge:gemini'], ['status', 'ok']],
  );
  assert.equal(hp.startTimeUnixNano, nanoOf('2026-11-04T00:00:00.000Z'));
  assert.equal(hp.timeUnixNano, `${nowMs}000000`);

  const counter = scope.metrics.find((m) => m.name === 'masteryls_client_login_total');
  assert.equal(counter.sum.aggregationTemporality, 2);
  assert.equal(counter.sum.isMonotonic, true);
  assert.equal(counter.sum.dataPoints.length, 1); // old series: no zero-bootstrap point
  assert.equal(counter.sum.dataPoints[0].asInt, '3');
});

test('buildOtlp zero-bootstraps a freshly-created counter so increase() sees the birth', () => {
  const createdAt = '2026-11-04T00:00:00.000Z';
  const nowMs = Date.parse(createdAt) + 30000; // 30s after creation (< 120s window)
  const fresh = [{ metric: 'masteryls_client_topic_views_total', labels: { course: 'CS 260', topic: 'HTML' }, kind: 'counter', count: 2, sum: 0, buckets: null, createdAt }];
  const dp = buildOtlp('masteryls', fresh, nowMs).resourceMetrics[0].scopeMetrics[0].metrics[0].sum.dataPoints;
  assert.equal(dp.length, 2); // zero point + value point
  assert.equal(dp[0].asInt, '0');
  assert.equal(dp[0].timeUnixNano, nanoOf(createdAt)); // zero sits at the series' createdAt
  assert.equal(dp[1].asInt, '2');
  assert.equal(dp[1].timeUnixNano, `${nowMs}000000`);
});

// --- handler ---

function flusher(overrides = {}) {
  return createTelemetryFlushHandler({
    getEnv: getEnv(overrides.env || ENV),
    readMetrics: overrides.readMetrics || (async () => rows),
    fetchFn: overrides.fetchFn || (async () => new Response('', { status: 200 })),
    now: () => 2,
  });
}
const flushReq = () => new Request('https://fn.example/telemetryflush', { method: 'POST' });

test('OPTIONS returns CORS preflight headers', async () => {
  const res = await flusher()(new Request('https://fn.example/telemetryflush', { method: 'OPTIONS' }));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), '*');
});

test('missing Grafana configuration returns 500', async () => {
  const res = await flusher({ env: {} })(flushReq());
  assert.equal(res.status, 500);
});

test('an empty table pushes nothing and returns 200', async () => {
  let forwarded = false;
  const res = await flusher({ readMetrics: async () => [], fetchFn: async () => ((forwarded = true), new Response('')) })(flushReq());
  assert.equal(res.status, 200);
  assert.equal((await res.json()).pushed, 0);
  assert.equal(forwarded, false);
});

test('rows are pushed to Grafana with the injected auth header and 202', async () => {
  const calls = [];
  const res = await flusher({
    fetchFn: async (url, options) => {
      calls.push({ url, options });
      return new Response('', { status: 200 });
    },
  })(flushReq());
  assert.equal(res.status, 202);
  assert.equal(calls[0].url, ENV.GRAFANA_OTLP_URL);
  assert.equal(calls[0].options.headers.Authorization, ENV.GRAFANA_OTLP_AUTH);
  const sent = JSON.parse(calls[0].options.body);
  assert.ok(sent.resourceMetrics[0].scopeMetrics[0].metrics.length >= 2);
});

test('a readMetrics failure returns 500', async () => {
  const res = await flusher({
    readMetrics: async () => {
      throw new Error('db down');
    },
  })(flushReq());
  assert.equal(res.status, 500);
});

test('an upstream rejection surfaces as 502 with status + detail', async () => {
  const res = await flusher({ fetchFn: async () => new Response('otlp parse error', { status: 400 }) })(flushReq());
  assert.equal(res.status, 502);
  const body = await res.json();
  assert.equal(body.status, 400);
  assert.equal(body.detail, 'otlp parse error');
});
