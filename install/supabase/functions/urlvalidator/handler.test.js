import test from 'node:test';
import assert from 'node:assert/strict';
import { createUrlValidatorHandler } from './handler.js';

function createMockSupabase({ user }) {
  return {
    auth: {
      async getUser() {
        return { data: { user }, error: null };
      },
    },
  };
}

function makeRequest(body, auth = 'Bearer token') {
  return new Request('https://local/functions/v1/urlvalidator', {
    method: 'POST',
    headers: auth ? { Authorization: auth, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('urlvalidator returns success when fetch responds ok', async () => {
  const handler = createUrlValidatorHandler({
    createSupabaseClientFromAuthHeader: () => createMockSupabase({ user: { id: 'u1', email: 'u1@test.com' } }),
    getEnv: (key) => ({ SUPABASE_URL: 'x', SUPABASE_SERVICE_ROLE_KEY: 'y' })[key],
    fetchFn: async () => new Response('ok', { status: 200 }),
  });

  const response = await handler(makeRequest({ url: 'https://example.com' }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.status, 200);
});

test('urlvalidator returns non-ok with status for HTTP errors', async () => {
  const handler = createUrlValidatorHandler({
    createSupabaseClientFromAuthHeader: () => createMockSupabase({ user: { id: 'u2', email: 'u2@test.com' } }),
    getEnv: (key) => ({ SUPABASE_URL: 'x', SUPABASE_SERVICE_ROLE_KEY: 'y' })[key],
    fetchFn: async () => new Response('missing', { status: 404, statusText: 'Not Found' }),
  });

  const response = await handler(makeRequest({ url: 'https://example.com/missing' }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.equal(body.status, 404);
});

test('urlvalidator rejects blocked local hosts', async () => {
  const handler = createUrlValidatorHandler({
    createSupabaseClientFromAuthHeader: () => createMockSupabase({ user: { id: 'u3', email: 'u3@test.com' } }),
    getEnv: (key) => ({ SUPABASE_URL: 'x', SUPABASE_SERVICE_ROLE_KEY: 'y' })[key],
    fetchFn: async () => new Response('ok', { status: 200 }),
  });

  const response = await handler(makeRequest({ url: 'http://localhost:3000' }));
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.match(body.error, /not allowed/i);
});

test('urlvalidator reports fetch exception as validation error payload', async () => {
  const handler = createUrlValidatorHandler({
    createSupabaseClientFromAuthHeader: () => createMockSupabase({ user: { id: 'u4', email: 'u4@test.com' } }),
    getEnv: (key) => ({ SUPABASE_URL: 'x', SUPABASE_SERVICE_ROLE_KEY: 'y' })[key],
    fetchFn: async () => {
      throw new Error('network down');
    },
  });

  const response = await handler(makeRequest({ url: 'https://example.com' }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.match(body.error, /unable to validate|timed out/i);
});
