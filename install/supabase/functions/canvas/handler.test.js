import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvasFunctionHandler } from './handler.js';

function createMockSupabase({ user, roles }) {
  return {
    auth: {
      async getUser() {
        return { data: { user }, error: null };
      },
    },
    from(table) {
      assert.equal(table, 'role');
      const filters = {};
      return {
        select() {
          return this;
        },
        eq(key, value) {
          filters[key] = String(value);
          return this;
        },
        limit() {
          const data = roles.filter((role) => Object.entries(filters).every(([k, v]) => String(role[k]) === v));
          return Promise.resolve({ data, error: null });
        },
      };
    },
  };
}

function makeRequest(body, auth = 'Bearer token') {
  return new Request('https://local/functions/v1/canvas', {
    method: 'POST',
    headers: auth ? { Authorization: auth, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('canvas handler allows root user', async () => {
  const fetchCalls = [];
  const handler = createCanvasFunctionHandler({
    createSupabaseClientFromAuthHeader: () =>
      createMockSupabase({
        user: { id: 'u1', email: 'root@test.com' },
        roles: [{ user: 'u1', right: 'root', object: null }],
      }),
    getEnv: (key) => ({ SUPABASE_URL: 'x', SUPABASE_SERVICE_ROLE_KEY: 'y', CANVAS_API_KEY: 'z' })[key],
    fetchFn: async (url, init) => {
      fetchCalls.push({ url, init });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    },
  });

  const response = await handler(makeRequest({ courseId: '12345', endpoint: '/courses/12345/modules', method: 'POST', body: { module: { name: 'M1' } } }));
  assert.equal(response.status, 200);
  assert.equal(fetchCalls.length, 1);
});

test('canvas handler allows editor with matching course', async () => {
  const fetchCalls = [];
  const handler = createCanvasFunctionHandler({
    createSupabaseClientFromAuthHeader: () =>
      createMockSupabase({
        user: { id: 'u2', email: 'editor@test.com' },
        roles: [{ user: 'u2', right: 'editor', object: 'catalog-uuid-1' }],
      }),
    getEnv: (key) => ({ SUPABASE_URL: 'x', SUPABASE_SERVICE_ROLE_KEY: 'y', CANVAS_API_KEY: 'z' })[key],
    fetchFn: async (url, init) => {
      fetchCalls.push({ url, init });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    },
  });

  const response = await handler(makeRequest({ courseId: '12345', catalogId: 'catalog-uuid-1', endpoint: '/courses/12345/pages', method: 'POST', body: { wiki_page: { title: 'T' } } }));
  assert.equal(response.status, 200);
  assert.equal(fetchCalls.length, 1);
});

test('canvas handler allows search_users membership lookup', async () => {
  const fetchCalls = [];
  const handler = createCanvasFunctionHandler({
    createSupabaseClientFromAuthHeader: () =>
      createMockSupabase({
        user: { id: 'u2', email: 'editor@test.com' },
        roles: [{ user: 'u2', right: 'editor', object: 'catalog-uuid-1' }],
      }),
    getEnv: (key) => ({ SUPABASE_URL: 'x', SUPABASE_SERVICE_ROLE_KEY: 'y', CANVAS_API_KEY: 'z' })[key],
    fetchFn: async (url, init) => {
      fetchCalls.push({ url, init });
      return new Response(JSON.stringify([{ id: 1, email: 'student@test.com' }]), { status: 200 });
    },
  });

  const response = await handler(makeRequest({ courseId: '12345', catalogId: 'catalog-uuid-1', endpoint: '/courses/12345/search_users?search_term=student%40test.com', method: 'GET', body: null }));
  assert.equal(response.status, 200);
  assert.equal(fetchCalls.length, 1);
});

test('canvas handler denies editor for different course', async () => {
  const fetchCalls = [];
  const handler = createCanvasFunctionHandler({
    createSupabaseClientFromAuthHeader: () =>
      createMockSupabase({
        user: { id: 'u3', email: 'editor@test.com' },
        roles: [{ user: 'u3', right: 'editor', object: '99999' }],
      }),
    getEnv: (key) => ({ SUPABASE_URL: 'x', SUPABASE_SERVICE_ROLE_KEY: 'y', CANVAS_API_KEY: 'z' })[key],
    fetchFn: async (url, init) => {
      fetchCalls.push({ url, init });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    },
  });

  const response = await handler(makeRequest({ courseId: '12345', endpoint: '/courses/12345/modules', method: 'POST', body: {} }));
  assert.equal(response.status, 403);
  assert.equal(fetchCalls.length, 0);
});

test('canvas handler denies malformed payload and disallowed endpoint', async () => {
  const handler = createCanvasFunctionHandler({
    createSupabaseClientFromAuthHeader: () =>
      createMockSupabase({
        user: { id: 'u4', email: 'root@test.com' },
        roles: [{ user: 'u4', right: 'root', object: null }],
      }),
    getEnv: (key) => ({ SUPABASE_URL: 'x', SUPABASE_SERVICE_ROLE_KEY: 'y', CANVAS_API_KEY: 'z' })[key],
    fetchFn: async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
  });

  const malformed = await handler(makeRequest({ endpoint: '/courses/12345/modules', method: 'POST', body: {} }));
  assert.equal(malformed.status, 400);

  const disallowed = await handler(makeRequest({ courseId: '12345', endpoint: '/courses/12345/users', method: 'GET', body: null }));
  assert.equal(disallowed.status, 403);
});
