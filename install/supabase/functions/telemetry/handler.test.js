import test from 'node:test';
import assert from 'node:assert/strict';
import { createTelemetryHandler, sanitizeDelta } from './handler.js';

const delta = {
  calls: [{ op: 'edge:gemini', status: 'ok', count: 2, sum: 150, buckets: [0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0] }],
  counters: [
    { metric: 'masteryls_client_login_total', labels: { result: 'success' }, count: 1 },
    { metric: 'masteryls_client_topic_views_total', labels: { course: 'CS 260', topic: 'HTML' }, count: 4 },
  ],
};

function post(body) {
  return new Request('https://fn.example/telemetry', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });
}

function handlerWith(record) {
  return createTelemetryHandler({ recordMetrics: record || (async () => {}) });
}

test('OPTIONS returns CORS preflight headers', async () => {
  const res = await handlerWith()(new Request('https://fn.example/telemetry', { method: 'OPTIONS' }));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), '*');
  assert.equal(res.headers.get('Access-Control-Max-Age'), '86400'); // preflight cached
});

test('non-POST methods are rejected', async () => {
  const res = await handlerWith()(new Request('https://fn.example/telemetry', { method: 'GET' }));
  assert.equal(res.status, 405);
});

test('invalid JSON body returns 400', async () => {
  const res = await handlerWith()(post('{ not json'));
  assert.equal(res.status, 400);
});

test('an empty delta (no calls and no counters) is rejected', async () => {
  let called = false;
  const res = await handlerWith(async () => {
    called = true;
  })(post({ calls: [], counters: [] }));
  assert.equal(res.status, 400);
  assert.equal(called, false);
});

test('an oversized payload returns 413', async () => {
  const big = { calls: [{ op: 'x', status: 'ok', count: 1, sum: 1, buckets: [1], pad: 'y'.repeat(300 * 1024) }] };
  const res = await handlerWith()(post(big));
  assert.equal(res.status, 413);
});

test('a valid delta is forwarded to recordMetrics and acknowledged with 202', async () => {
  const seen = [];
  const res = await handlerWith(async (c, counters) => {
    seen.push([c, counters]);
  })(post(delta));
  assert.equal(res.status, 202);
  assert.equal(seen.length, 1);
  assert.deepEqual(seen[0][0], delta.calls);
  assert.deepEqual(seen[0][1], delta.counters);
});

test('only counters present (no calls) is still accepted', async () => {
  const res = await handlerWith()(post({ counters: [{ metric: 'masteryls_client_enrollments_total', labels: { course: 'CS 260' }, count: 2 }] }));
  assert.equal(res.status, 202);
});

test('a recordMetrics failure surfaces as 502 with the error detail', async () => {
  const res = await handlerWith(async () => {
    throw new Error('db down');
  })(post(delta));
  assert.equal(res.status, 502);
  assert.equal((await res.json()).detail, 'db down');
});

test('sanitizeDelta drops non-allowlisted ops/metrics/labels and non-positive counts (cardinality guard)', () => {
  const dirty = {
    calls: [
      { op: 'edge:gemini', status: 'ok', count: 2, sum: 150, buckets: [0, 1] }, // kept
      { op: 'evil:injected', status: 'ok', count: 5, sum: 5, buckets: [5] }, // dropped: op not allowed
      { op: 'github', status: '200', count: 5, sum: 5, buckets: [5] }, // dropped: status not allowed
    ],
    counters: [
      { metric: 'masteryls_client_login_total', labels: { result: 'success' }, count: 3 }, // kept
      { metric: 'masteryls_client_login_total', labels: { result: 'maybe' }, count: 9 }, // dropped: bad result
      { metric: 'masteryls_client_topic_views_total', labels: { course: 'CS 260', topic: 'HTML', evil: 'x' }, count: 5 }, // kept, evil label stripped
      { metric: 'masteryls_client_topic_views_total', labels: { topic: 'no course' }, count: 1 }, // dropped: no course
      { metric: 'evil_metric', labels: { course: 'x' }, count: 1 }, // dropped: metric not allowed
    ],
  };
  const clean = sanitizeDelta(dirty);
  assert.deepEqual(clean.calls, [{ op: 'edge:gemini', status: 'ok', count: 2, sum: 150, buckets: [0, 1] }]);
  assert.deepEqual(clean.counters, [
    { metric: 'masteryls_client_login_total', labels: { result: 'success' }, count: 3 },
    { metric: 'masteryls_client_topic_views_total', labels: { course: 'CS 260', topic: 'HTML' }, count: 5 },
  ]);
});

test('sanitizeDelta truncates over-long label values', () => {
  const long = 'x'.repeat(500);
  const clean = sanitizeDelta({ counters: [{ metric: 'masteryls_client_enrollments_total', labels: { course: long }, count: 1 }] });
  assert.equal(clean.counters[0].labels.course.length, 160);
});

test('an all-junk payload is rejected with 400 (nothing survives sanitizing)', async () => {
  let called = false;
  const res = await handlerWith(async () => {
    called = true;
  })(post({ calls: [{ op: 'evil', status: 'nope', count: 1, sum: 1, buckets: [1] }], counters: [{ metric: 'evil', labels: { course: 'x' }, count: 1 }] }));
  assert.equal(res.status, 400);
  assert.equal(called, false);
});
