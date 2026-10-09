import test from 'node:test';
import assert from 'node:assert/strict';
import { createMasteryOverviewHandler } from './handler.js';

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
      if (filter.kind === 'gte') {
        rows = rows.filter((row) => row?.[filter.key] != null && String(row[filter.key]) >= String(filter.value));
      }
      if (filter.kind === 'lte') {
        rows = rows.filter((row) => row?.[filter.key] != null && String(row[filter.key]) <= String(filter.value));
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
    gte(key, value) {
      filters.push({ kind: 'gte', key, value });
      return query;
    },
    lte(key, value) {
      filters.push({ kind: 'lte', key, value });
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

test('gradebookoverview returns identity plus a trimmed progress blob for the list', async () => {
  const handler = createMasteryOverviewHandler({
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
              progress: {
                mastery: 80,
                lastActivityAt: '2026-05-09T12:20:00Z',
                totalTimeSpent: 999,
                'topic-1': { scores: { i1: 100, i2: null }, interactions: ['i1'], timeSpent: 120, lastInteractionAt: '2026-05-09T12:00:00Z', examCompleted: true, mode: 'ai', notes: true },
                'topic-2': { scores: { i9: 50 }, timeSpent: 60, projectSubmission: true },
              },
            },
          ],
          user: [{ id: 'u1', name: 'Learner One', email: 'learner1@test.com' }],
        },
      }),
    getEnv: (key) => ({ SUPABASE_URL: 'x', SUPABASE_SERVICE_ROLE_KEY: 'y' })[key],
  });

  const response = await handler(makeRequest({ courseId: 'course-1' }));
  assert.equal(response.status, 200);

  const body = await response.json();
  assert.equal(body.totalCount, 1);
  assert.equal(body.rows.length, 1);

  const row = body.rows[0];
  assert.equal(row.learnerName, 'Learner One');
  assert.equal(row.learnerEmail, 'learner1@test.com');

  // The server no longer computes metrics; the client derives them from the trimmed progress.
  assert.equal(row.masteryPercent, undefined);
  assert.equal(row.completedTopics, undefined);
  assert.equal(row.totalTimeSpent, undefined);

  // Top-level fallbacks are preserved.
  assert.equal(row.progress.mastery, 80);
  assert.equal(row.progress.lastActivityAt, '2026-05-09T12:20:00Z');
  assert.equal(row.progress.totalTimeSpent, 999);

  // Each topic is reduced to completedCount (scores/interactions collapsed) plus the fields the
  // list derivation reads; raw scores and non-overview fields are dropped.
  assert.deepEqual(row.progress['topic-1'], { completedCount: 2, timeSpent: 120, lastInteractionAt: '2026-05-09T12:00:00Z', examCompleted: true });
  assert.deepEqual(row.progress['topic-2'], { completedCount: 1, timeSpent: 60, projectSubmission: true });
  assert.equal(row.progress['topic-1'].scores, undefined);
});

test('gradebookoverview allows editor for matching course', async () => {
  const handler = createMasteryOverviewHandler({
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

test('gradebookoverview allows mentor for matching course', async () => {
  const handler = createMasteryOverviewHandler({
    createSupabaseClientFromAuthHeader: () =>
      createMockSupabase({
        user: { id: 'mentor-user', email: 'mentor@test.com' },
        dataMap: {
          role: [{ id: 'r3', user: 'mentor-user', right: 'mentor', object: 'course-1' }],
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

test('gradebookoverview denies mentor for other course', async () => {
  const handler = createMasteryOverviewHandler({
    createSupabaseClientFromAuthHeader: () =>
      createMockSupabase({
        user: { id: 'mentor-user', email: 'mentor@test.com' },
        dataMap: {
          role: [{ id: 'r3', user: 'mentor-user', right: 'mentor', object: 'course-9' }],
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

test('gradebookoverview denies editor for other course', async () => {
  const handler = createMasteryOverviewHandler({
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
  const handler = createMasteryOverviewHandler({
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
  const handler = createMasteryOverviewHandler({
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

test('gradebookoverview returns the FULL progress blob for a single-learner request', async () => {
  const fullTopic = { scores: { i1: 100, i2: 80 }, interactions: ['i1'], timeSpent: 120, lastInteractionAt: '2026-05-09T12:00:00Z', masteryScore: 75, itemsCompleted: 3, totalItems: 6, mode: 'ai' };
  const handler = createMasteryOverviewHandler({
    createSupabaseClientFromAuthHeader: () =>
      createMockSupabase({
        user: { id: 'root-user', email: 'root@test.com' },
        dataMap: {
          role: [{ id: 'r1', user: 'root-user', right: 'root', object: null }],
          enrollment: [
            { id: 'e1', learnerId: 'u1', catalogId: 'course-1', progress: { mastery: 70, 'topic-1': fullTopic } },
            { id: 'e2', learnerId: 'u2', catalogId: 'course-1', progress: { mastery: 90 } },
          ],
          user: [
            { id: 'u1', name: 'Alice', email: 'alice@test.com' },
            { id: 'u2', name: 'Bob', email: 'bob@test.com' },
          ],
        },
      }),
    getEnv: (key) => ({ SUPABASE_URL: 'x', SUPABASE_SERVICE_ROLE_KEY: 'y' })[key],
  });

  const response = await handler(makeRequest({ courseId: 'course-1', learnerId: 'u1' }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.rows.length, 1);
  assert.equal(body.rows[0].learnerId, 'u1');
  assert.equal(body.rows[0].learnerEmail, 'alice@test.com');

  // The drill-down needs per-interaction scores and DRA/interview fields, so a single-learner
  // request is NOT trimmed - the raw entry is returned verbatim.
  assert.deepEqual(body.rows[0].progress['topic-1'], fullTopic);
});

test('gradebookoverview returns every enrollment without paginating (client paginates)', async () => {
  const enrollment = [];
  const user = [];
  for (let i = 1; i <= 120; i++) {
    enrollment.push({ id: `e${i}`, learnerId: `u${i}`, catalogId: 'course-1', progress: { mastery: i } });
    user.push({ id: `u${i}`, name: `Learner ${i}`, email: `l${i}@test.com` });
  }

  const handler = createMasteryOverviewHandler({
    createSupabaseClientFromAuthHeader: () =>
      createMockSupabase({
        user: { id: 'root-user', email: 'root@test.com' },
        dataMap: {
          role: [{ id: 'r1', user: 'root-user', right: 'root', object: null }],
          enrollment,
          user,
        },
      }),
    getEnv: (key) => ({ SUPABASE_URL: 'x', SUPABASE_SERVICE_ROLE_KEY: 'y' })[key],
  });

  const response = await handler(makeRequest({ courseId: 'course-1' }));
  assert.equal(response.status, 200);
  const body = await response.json();

  // No server-side page cap - the client holds the whole set to sort/paginate locally.
  assert.equal(body.totalCount, 120);
  assert.equal(body.rows.length, 120);
  assert.equal(body.page, undefined);
  assert.equal(body.hasMore, undefined);
});

function datedCohortClient() {
  return createMockSupabase({
    user: { id: 'root-user', email: 'root@test.com' },
    dataMap: {
      role: [{ id: 'r1', user: 'root-user', right: 'root', object: null }],
      enrollment: [
        { id: 'e-old', learnerId: 'u-old', catalogId: 'course-1', createdAt: '2025-08-20T09:00:00Z', progress: {} },
        { id: 'e-cur1', learnerId: 'u-cur1', catalogId: 'course-1', createdAt: '2026-01-15T09:00:00Z', progress: {} },
        { id: 'e-cur2', learnerId: 'u-cur2', catalogId: 'course-1', createdAt: '2026-02-10T09:00:00Z', progress: {} },
        { id: 'e-future', learnerId: 'u-future', catalogId: 'course-1', createdAt: '2026-09-01T09:00:00Z', progress: {} },
      ],
      user: [
        { id: 'u-old', name: 'Old Cohort', email: 'old@test.com' },
        { id: 'u-cur1', name: 'Current One', email: 'cur1@test.com' },
        { id: 'u-cur2', name: 'Current Two', email: 'cur2@test.com' },
        { id: 'u-future', name: 'Future Cohort', email: 'future@test.com' },
      ],
    },
  });
}

test('gradebookoverview restricts an overseer roster to enrollments created within the window', async () => {
  const handler = createMasteryOverviewHandler({
    createSupabaseClientFromAuthHeader: datedCohortClient,
    getEnv: (key) => ({ SUPABASE_URL: 'x', SUPABASE_SERVICE_ROLE_KEY: 'y' })[key],
  });

  const response = await handler(makeRequest({ courseId: 'course-1', startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-06-30T23:59:59.999Z' }));
  assert.equal(response.status, 200);
  const body = await response.json();

  // Only the two learners enrolled during the window; the prior and future cohorts are excluded.
  assert.equal(body.totalCount, 2);
  assert.deepEqual(body.rows.map((r) => r.learnerId).sort(), ['u-cur1', 'u-cur2']);
});

test('gradebookoverview ignores the date window for a single-learner drill-down', async () => {
  const handler = createMasteryOverviewHandler({
    createSupabaseClientFromAuthHeader: datedCohortClient,
    getEnv: (key) => ({ SUPABASE_URL: 'x', SUPABASE_SERVICE_ROLE_KEY: 'y' })[key],
  });

  // u-old is outside the window but must still resolve when requested specifically.
  const response = await handler(makeRequest({ courseId: 'course-1', learnerId: 'u-old', startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-06-30T23:59:59.999Z' }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.rows.length, 1);
  assert.equal(body.rows[0].learnerId, 'u-old');
});

test('gradebookoverview never date-filters a non-overseer self view', async () => {
  const handler = createMasteryOverviewHandler({
    createSupabaseClientFromAuthHeader: () =>
      createMockSupabase({
        user: { id: 'u-old', email: 'old@test.com' },
        dataMap: {
          role: [],
          enrollment: [
            { id: 'e-old', learnerId: 'u-old', catalogId: 'course-1', createdAt: '2025-08-20T09:00:00Z', progress: {} },
            { id: 'e-cur1', learnerId: 'u-cur1', catalogId: 'course-1', createdAt: '2026-01-15T09:00:00Z', progress: {} },
          ],
          user: [{ id: 'u-old', name: 'Old Cohort', email: 'old@test.com' }],
        },
      }),
    getEnv: (key) => ({ SUPABASE_URL: 'x', SUPABASE_SERVICE_ROLE_KEY: 'y' })[key],
  });

  // The learner enrolled before the window still sees their own row (and only their own).
  const response = await handler(makeRequest({ courseId: 'course-1', startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-06-30T23:59:59.999Z' }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.rows.length, 1);
  assert.equal(body.rows[0].learnerId, 'u-old');
});
