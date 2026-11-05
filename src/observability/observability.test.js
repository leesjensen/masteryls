import test from 'node:test';
import assert from 'node:assert/strict';
import { instrument, logAction, recordLogin, setObservabilityUser, httpClass, buildDeltaPayload } from './observability.js';

// Most tests run with observability uninitialized (config.observability.enabled is false by default
// and initObservability is never called), so both sinks are off and every runtime export is a
// no-op. The contract that matters: wrapping a real service call with instrument() must never alter
// the resolved value or swallow a rejection, and the fire-and-forget helpers must never throw.

test('instrument returns the wrapped fn resolved value unchanged when disabled', async () => {
  const value = { ok: true, items: [1, 2, 3] };
  const result = await instrument('edge:test', { fn: 'test' }, async () => value);
  assert.equal(result, value);
});

test('instrument rethrows the wrapped fn rejection unchanged when disabled', async () => {
  const boom = new Error('boom');
  await assert.rejects(
    () => instrument('edge:test', { fn: 'test' }, async () => {
      throw boom;
    }),
    (err) => err === boom,
  );
});

test('instrument preserves a synchronously-returned (non-promise) value', async () => {
  const result = await instrument('github', {}, () => 'sync');
  assert.equal(result, 'sync');
});

test('instrument ignores a classify callback when disabled (never records)', async () => {
  // classify should not even be invoked when both sinks are off; result passes straight through.
  let called = false;
  const result = await instrument('github', {}, () => ({ status: 404 }), () => {
    called = true;
    return '4xx';
  });
  assert.deepEqual(result, { status: 404 });
  assert.equal(called, false);
});

test('logAction, recordLogin and setObservabilityUser are safe no-ops when disabled', () => {
  assert.doesNotThrow(() => logAction('enroll', { courseId: 'c1' }));
  assert.doesNotThrow(() => logAction('no-args'));
  assert.doesNotThrow(() => recordLogin('success'));
  assert.doesNotThrow(() => recordLogin('failure'));
  assert.doesNotThrow(() => setObservabilityUser({ id: 'u1', isRoot: () => true }));
  assert.doesNotThrow(() => setObservabilityUser(null));
});

// --- pure helpers (always exercisable, sink-independent) ---

test('httpClass buckets status codes into ok / 4xx / 5xx / error', () => {
  assert.equal(httpClass(200), 'ok');
  assert.equal(httpClass(204), 'ok');
  assert.equal(httpClass(302), 'ok');
  assert.equal(httpClass(400), '4xx');
  assert.equal(httpClass(404), '4xx');
  assert.equal(httpClass(499), '4xx');
  assert.equal(httpClass(500), '5xx');
  assert.equal(httpClass(503), '5xx');
  assert.equal(httpClass(undefined), 'error');
  assert.equal(httpClass(null), 'error');
  assert.equal(httpClass(NaN), 'error');
  assert.equal(httpClass('500'), 'error');
});

test('buildDeltaPayload returns null when there is nothing with a non-zero count', () => {
  assert.equal(buildDeltaPayload([], []), null);
  const zero = [{ op: 'github', status: 'ok', count: 0, sum: 0, buckets: [0, 0] }];
  assert.equal(buildDeltaPayload(zero, []), null);
});

test('buildDeltaPayload emits compact per-series deltas + generic counters, dropping zero entries', () => {
  const histograms = [
    { op: 'edge:gemini', status: 'ok', count: 2, sum: 150, buckets: [0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0] },
    { op: 'github', status: '4xx', count: 0, sum: 0, buckets: [0, 0] }, // dropped (zero)
  ];
  const counters = [
    { metric: 'masteryls_client_login_total', labels: { result: 'success' }, value: 3 },
    { metric: 'masteryls_client_topic_views_total', labels: { course: 'CS 260', topic: 'HTML' }, value: 5 },
    { metric: 'masteryls_client_enrollments_total', labels: { course: 'CS 260' }, value: 0 }, // dropped (zero)
  ];
  const payload = buildDeltaPayload(histograms, counters);

  assert.deepEqual(payload.calls, [
    { op: 'edge:gemini', status: 'ok', count: 2, sum: 150, buckets: [0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0] },
  ]);
  assert.deepEqual(payload.counters, [
    { metric: 'masteryls_client_login_total', labels: { result: 'success' }, count: 3 },
    { metric: 'masteryls_client_topic_views_total', labels: { course: 'CS 260', topic: 'HTML' }, count: 5 },
  ]);
});
