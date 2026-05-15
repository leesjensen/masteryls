import test from 'node:test';
import assert from 'node:assert/strict';
import { createGradebookOverviewHandler } from './handler.js';

function buildQuery(table, dataMap) {
  const filters = [];
  let selectedColumns = null;
  let sortBy = null;
  let sortAscending = true;
  let rowLimit = null;

  const execute = async () => {
    let rows = Array.isArray(dataMap[table]) ? [...dataMap[table]] : [];

    for (const filter of filters) {
      if (filter.kind === 'eq') {
        rows = rows.filter((row) => String(row?.[filter.key]) === String(filter.value));
      }
      if (filter.kind === 'in') {
        const allowed = new Set((filter.values || []).map((value) => String(value)));
        rows = rows.filter((row) => allowed.has(String(row?.[filter.key])));
      }
    }

    if (sortBy) {
      rows.sort((a, b) => {
        const av = a?.[sortBy];
        const bv = b?.[sortBy];
        if (av === bv) {
          return 0;
        }
        if (av == null) {
          return 1;
        }
        if (bv == null) {
          return -1;
        }
        return av < bv ? (sortAscending ? -1 : 1) : sortAscending ? 1 : -1;
      });
    }

    if (Number.isFinite(rowLimit)) {
      rows = rows.slice(0, rowLimit);
    }

    if (selectedColumns && selectedColumns !== '*') {
      const columns = selectedColumns
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
      rows = rows.map((row) => {
        const partial = {};
        columns.forEach((column) => {
          partial[column] = row?.[column];
        });
        return partial;
      });
    }

    return { data: rows, error: null };
  };

  const query = {
    select(columns) {
      selectedColumns = columns;
      return query;
    },
    eq(key, value) {
      filters.push({ kind: 'eq', key, value });
      return query;
    },
    in(key, values) {
      filters.push({ kind: 'in', key, values });
      return query;
    },
    order(key, options = {}) {
      sortBy = key;
      sortAscending = options.ascending !== false;
      return query;
    },
    limit(value) {
      rowLimit = Number(value);
      return query;
    },
    then(resolve, reject) {
      return execute().then(resolve, reject);
    },
  };

  return query;
}

function createMockSupabase({ user, dataMap }) {
  return {
    auth: {
      async getUser() {
        return { data: { user }, error: null };
      },
    },
    from(table) {
      return buildQuery(table, dataMap);
    },
  };
}

function makeRequest(body, auth = 'Bearer token') {
  return new Request('https://local/functions/v1/gradebookoverview', {
    method: 'POST',
    headers: auth ? { Authorization: auth, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('gradebookoverview allows root and returns aggregated rows', async () => {
  const handler = createGradebookOverviewHandler({
    createSupabaseClientFromAuthHeader: () =>
      createMockSupabase({
        user: { id: 'root-user', email: 'root@test.com' },
        dataMap: {
          role: [{ id: 'r1', user: 'root-user', right: 'root', object: null }],
          enrollment: [
            {
              id: 'e1',
              learnerId: 'u1',
              catalogId: 'course-1',
              progress: { mastery: 80, 'topic-1': { interactions: [] }, 'topic-2': { interactions: [] } },
            },
          ],
          user: [{ id: 'u1', name: 'Learner One', email: 'learner1@test.com' }],
          progress: [
            { enrollmentId: 'e1', catalogId: 'course-1', type: 'exam', details: { state: 'completed' }, createdAt: '2026-05-09T12:00:00Z' },
            { enrollmentId: 'e1', catalogId: 'course-1', type: 'quizSubmit', interactionId: 'project-1', topicId: 'topic-1', details: { syncGrade: true }, createdAt: '2026-05-09T12:10:00Z' },
            { enrollmentId: 'e1', catalogId: 'course-1', type: 'quizSubmit', interactionId: 'project-1', topicId: 'topic-1', details: { syncGrade: true }, createdAt: '2026-05-09T12:20:00Z' },
          ],
        },
      }),
    getEnv: (key) => ({ SUPABASE_URL: 'x', SUPABASE_SERVICE_ROLE_KEY: 'y' })[key],
  });

  const response = await handler(makeRequest({ courseId: 'course-1', page: 1, limit: 10 }));
  assert.equal(response.status, 200);

  const body = await response.json();
  assert.equal(body.totalCount, 1);
  assert.equal(body.rows.length, 1);
  assert.equal(body.rows[0].learnerName, 'Learner One');
  assert.equal(body.rows[0].masteryPercent, 80);
  assert.equal(body.rows[0].completedTopics, 2);
  assert.equal(body.rows[0].examCompletedCount, 1);
  assert.equal(body.rows[0].projectSubmittedCount, 1);
  assert.equal(body.rows[0].lastActivityAt, '2026-05-09T12:20:00Z');
});

test('gradebookoverview allows editor for matching course', async () => {
  const handler = createGradebookOverviewHandler({
    createSupabaseClientFromAuthHeader: () =>
      createMockSupabase({
        user: { id: 'editor-user', email: 'editor@test.com' },
        dataMap: {
          role: [{ id: 'r2', user: 'editor-user', right: 'editor', object: 'course-1' }],
          enrollment: [{ id: 'e1', learnerId: 'u1', catalogId: 'course-1', progress: { mastery: 10 } }],
          user: [{ id: 'u1', name: 'Learner One', email: 'learner1@test.com' }],
          progress: [],
        },
      }),
    getEnv: (key) => ({ SUPABASE_URL: 'x', SUPABASE_SERVICE_ROLE_KEY: 'y' })[key],
  });

  const response = await handler(makeRequest({ courseId: 'course-1' }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.totalCount, 1);
});

test('gradebookoverview denies editor for other course', async () => {
  const handler = createGradebookOverviewHandler({
    createSupabaseClientFromAuthHeader: () =>
      createMockSupabase({
        user: { id: 'editor-user', email: 'editor@test.com' },
        dataMap: {
          role: [{ id: 'r2', user: 'editor-user', right: 'editor', object: 'course-9' }],
          enrollment: [],
          user: [],
          progress: [],
        },
      }),
    getEnv: (key) => ({ SUPABASE_URL: 'x', SUPABASE_SERVICE_ROLE_KEY: 'y' })[key],
  });

  const response = await handler(makeRequest({ courseId: 'course-1' }));
  assert.equal(response.status, 403);
});

test('gradebookoverview allows enrolled learner and scopes to own row', async () => {
  const handler = createGradebookOverviewHandler({
    createSupabaseClientFromAuthHeader: () =>
      createMockSupabase({
        user: { id: 'learner-user', email: 'learner@test.com' },
        dataMap: {
          role: [],
          enrollment: [
            { id: 'e1', learnerId: 'learner-user', catalogId: 'course-1', progress: { mastery: 42 } },
            { id: 'e2', learnerId: 'other-learner', catalogId: 'course-1', progress: { mastery: 88 } },
          ],
          user: [
            { id: 'learner-user', name: 'Current Learner', email: 'learner@test.com' },
            { id: 'other-learner', name: 'Other Learner', email: 'other@test.com' },
          ],
          progress: [],
        },
      }),
    getEnv: (key) => ({ SUPABASE_URL: 'x', SUPABASE_SERVICE_ROLE_KEY: 'y' })[key],
  });

  const response = await handler(makeRequest({ courseId: 'course-1' }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.totalCount, 1);
  assert.equal(body.rows.length, 1);
  assert.equal(body.rows[0].learnerId, 'learner-user');
  assert.equal(body.rows[0].learnerEmail, 'learner@test.com');
});

test('gradebookoverview denies learner not enrolled in requested course', async () => {
  const handler = createGradebookOverviewHandler({
    createSupabaseClientFromAuthHeader: () =>
      createMockSupabase({
        user: { id: 'learner-user', email: 'learner@test.com' },
        dataMap: {
          role: [],
          enrollment: [{ id: 'e2', learnerId: 'learner-user', catalogId: 'course-2', progress: { mastery: 88 } }],
          user: [{ id: 'learner-user', name: 'Current Learner', email: 'learner@test.com' }],
          progress: [],
        },
      }),
    getEnv: (key) => ({ SUPABASE_URL: 'x', SUPABASE_SERVICE_ROLE_KEY: 'y' })[key],
  });

  const response = await handler(makeRequest({ courseId: 'course-1' }));
  assert.equal(response.status, 403);
});

test('gradebookoverview applies learner search and pagination metadata', async () => {
  const handler = createGradebookOverviewHandler({
    createSupabaseClientFromAuthHeader: () =>
      createMockSupabase({
        user: { id: 'root-user', email: 'root@test.com' },
        dataMap: {
          role: [{ id: 'r1', user: 'root-user', right: 'root', object: null }],
          enrollment: [
            { id: 'e1', learnerId: 'u1', catalogId: 'course-1', progress: { mastery: 20 } },
            { id: 'e2', learnerId: 'u2', catalogId: 'course-1', progress: { mastery: 30 } },
          ],
          user: [
            { id: 'u1', name: 'Alice', email: 'alice@test.com' },
            { id: 'u2', name: 'Bob', email: 'bob@test.com' },
          ],
          progress: [],
        },
      }),
    getEnv: (key) => ({ SUPABASE_URL: 'x', SUPABASE_SERVICE_ROLE_KEY: 'y' })[key],
  });

  const response = await handler(makeRequest({ courseId: 'course-1', search: 'bob', page: 1, limit: 1 }));
  assert.equal(response.status, 200);
  const body = await response.json();

  assert.equal(body.totalCount, 1);
  assert.equal(body.limit, 1);
  assert.equal(body.page, 1);
  assert.equal(body.hasMore, false);
  assert.equal(body.rows.length, 1);
  assert.equal(body.rows[0].learnerEmail, 'bob@test.com');
});
