import test from 'node:test';
import assert from 'node:assert/strict';
import { createLogPushHandler, buildLokiStreams } from './handler.js';

const ENV = { LOKI_URL: 'https://logs.example/loki/api/v1/push', LOKI_AUTH: 'Basic abc123' };
const getEnv = (env) => (key) => env[key];

const batch = {
  entries: [
    { ts: '1762300000000000000', level: 'info', line: '{"event_name":"enroll","courseId":"c1"}' },
    { ts: '1762300005000000000', level: 'error', line: '{"event_name":"exception","message":"boom"}' },
  ],
};

function post(body) {
  return new Request('https://fn.example/logpush', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });
}

function handlerWith(overrides = {}) {
  return createLogPushHandler({
    getEnv: getEnv(overrides.env || ENV),
    fetchFn: overrides.fetchFn || (async () => new Response(null, { status: 204 })),
  });
}

// --- buildLokiStreams (pure) ---

test('buildLokiStreams groups by level, labels app+level, sorts values by timestamp', () => {
  const out = buildLokiStreams([
    { ts: '30', level: 'info', line: 'c' },
    { ts: '10', level: 'info', line: 'a' },
    { ts: '20', level: 'error', line: 'b' },
  ]);
  const info = out.streams.find((s) => s.stream.level === 'info');
  const err = out.streams.find((s) => s.stream.level === 'error');
  assert.deepEqual(info.stream, { app: 'masteryls', level: 'info' });
  assert.deepEqual(info.values, [['10', 'a'], ['30', 'c']]); // sorted ascending
  assert.deepEqual(err.values, [['20', 'b']]);
});

test('buildLokiStreams drops malformed entries (non-numeric ts, non-string line)', () => {
  const out = buildLokiStreams([
    { ts: 'abc', level: 'info', line: 'x' },
    { ts: '10', level: 'info', line: 42 },
    { ts: '20', level: 'info', line: 'ok' },
  ]);
  assert.equal(out.streams.length, 1);
  assert.deepEqual(out.streams[0].values, [['20', 'ok']]);
});

// --- handler ---

test('OPTIONS returns CORS preflight headers', async () => {
  const res = await handlerWith()(new Request('https://fn.example/logpush', { method: 'OPTIONS' }));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), '*');
  assert.equal(res.headers.get('Access-Control-Max-Age'), '86400'); // preflight cached
});

test('non-POST methods are rejected', async () => {
  const res = await handlerWith()(new Request('https://fn.example/logpush', { method: 'GET' }));
  assert.equal(res.status, 405);
});

test('missing Loki configuration returns 500 and does not forward', async () => {
  let forwarded = false;
  const res = await handlerWith({ env: {}, fetchFn: async () => ((forwarded = true), new Response('')) })(post(batch));
  assert.equal(res.status, 500);
  assert.equal(forwarded, false);
});

test('invalid JSON body returns 400', async () => {
  const res = await handlerWith()(post('{ not json'));
  assert.equal(res.status, 400);
});

test('an empty batch is rejected', async () => {
  const res = await handlerWith()(post({ entries: [] }));
  assert.equal(res.status, 400);
});

test('a valid batch is forwarded to Loki with the injected auth header and 202', async () => {
  const calls = [];
  const res = await handlerWith({
    fetchFn: async (url, options) => {
      calls.push({ url, options });
      return new Response(null, { status: 204 });
    },
  })(post(batch));
  assert.equal(res.status, 202);
  assert.equal(calls[0].url, ENV.LOKI_URL);
  assert.equal(calls[0].options.headers.Authorization, ENV.LOKI_AUTH);
  const sent = JSON.parse(calls[0].options.body);
  assert.equal(sent.streams.length, 2); // info + error
});

test('an upstream rejection surfaces as 502 with status + detail', async () => {
  const res = await handlerWith({ fetchFn: async () => new Response('entry out of order', { status: 400 }) })(post(batch));
  assert.equal(res.status, 502);
  const body = await res.json();
  assert.equal(body.status, 400);
  assert.equal(body.detail, 'entry out of order');
});
