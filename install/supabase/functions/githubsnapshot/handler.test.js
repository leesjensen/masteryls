import test from 'node:test';
import assert from 'node:assert/strict';
import { createGitHubSnapshotHandler } from './handler.js';

function makeRequest(body) {
  return new Request('https://local/functions/v1/githubsnapshot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('githubsnapshot returns lowercased SHA for SHA ref input without fetch', async () => {
  let fetchCalls = 0;
  const handler = createGitHubSnapshotHandler({
    fetchFn: async () => {
      fetchCalls += 1;
      return new Response('', { status: 500 });
    },
  });

  const response = await handler(makeRequest({ owner: 'byucsstudent', repository: 'simple-fastpath', ref: 'ABCDEF1234567890ABCDEF1234567890ABCDEF12' }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.sha, 'abcdef1234567890abcdef1234567890abcdef12');
  assert.equal(fetchCalls, 0);
});

test('githubsnapshot resolves branch SHA from git info refs payload', async () => {
  const sha = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const infoRefsPayload = `001e# service=git-upload-pack\n0000\n0045${sha} refs/heads/main\u0000multi_ack thin-pack side-band side-band-64k\n0000`;

  const handler = createGitHubSnapshotHandler({
    fetchFn: async () => new Response(infoRefsPayload, { status: 200 }),
  });

  const response = await handler(makeRequest({ owner: 'byucsstudent', repository: 'simple-parse', ref: 'main' }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.sha, sha);
  assert.equal(body.fallback, false);
});

test('githubsnapshot caches resolved branch SHA for repeated requests', async () => {
  const sha = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const infoRefsPayload = `001e# service=git-upload-pack\n0000\n0045${sha} refs/heads/main\u0000multi_ack\n0000`;

  let fetchCalls = 0;
  const handler = createGitHubSnapshotHandler({
    fetchFn: async () => {
      fetchCalls += 1;
      return new Response(infoRefsPayload, { status: 200 });
    },
  });

  const first = await handler(makeRequest({ owner: 'byucsstudent', repository: 'simple-cache', ref: 'main' }));
  const firstBody = await first.json();
  assert.equal(firstBody.sha, sha);
  assert.equal(firstBody.cached, undefined);

  const second = await handler(makeRequest({ owner: 'byucsstudent', repository: 'simple-cache', ref: 'main' }));
  const secondBody = await second.json();
  assert.equal(secondBody.sha, sha);
  assert.equal(secondBody.cached, true);
  assert.equal(fetchCalls, 1);
});

test('githubsnapshot deduplicates concurrent requests for same owner/repo/ref', async () => {
  const sha = 'cccccccccccccccccccccccccccccccccccccccc';
  const infoRefsPayload = `001e# service=git-upload-pack\n0000\n0045${sha} refs/heads/main\u0000multi_ack\n0000`;

  let fetchCalls = 0;
  const handler = createGitHubSnapshotHandler({
    fetchFn: async () => {
      fetchCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 50));
      return new Response(infoRefsPayload, { status: 200 });
    },
  });

  const [r1, r2] = await Promise.all([handler(makeRequest({ owner: 'byucsstudent', repository: 'simple-dedupe', ref: 'main' })), handler(makeRequest({ owner: 'byucsstudent', repository: 'simple-dedupe', ref: 'main' }))]);

  const [b1, b2] = await Promise.all([r1.json(), r2.json()]);
  assert.equal(b1.sha, sha);
  assert.equal(b2.sha, sha);
  assert.equal(fetchCalls, 1);
});

test('githubsnapshot falls back to ref when upstream fetch is non-ok', async () => {
  const handler = createGitHubSnapshotHandler({
    fetchFn: async () => new Response('upstream error', { status: 503 }),
  });

  const response = await handler(makeRequest({ owner: 'byucsstudent', repository: 'simple-fallback', ref: 'main' }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.sha, 'main');
  assert.equal(body.fallback, true);
});

test('githubsnapshot validates owner and repository format', async () => {
  const handler = createGitHubSnapshotHandler({
    fetchFn: async () => new Response('', { status: 200 }),
  });

  const response = await handler(makeRequest({ owner: 'bad owner', repository: 'simple-validate', ref: 'main' }));
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.match(body.error, /invalid owner or repository/i);
});
