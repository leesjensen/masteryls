import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvasGradebookHandler } from './handler.js';

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
  return new Request('https://local/functions/v1/canvasgradebook', {
    method: 'POST',
    headers: auth ? { Authorization: auth, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function buildFetchStub() {
  const calls = [];
  const fetchFn = async (url, init) => {
    calls.push({ url, init });
    if (url.includes('/search_users?search_term=')) {
      return new Response(JSON.stringify([{ id: 77, email: 'learner@test.com', login_id: 'learner@test.com' }]), { status: 200 });
    }
    if (url.includes('/quizzes/')) {
      return new Response(JSON.stringify({ assignment_id: 555 }), { status: 200 });
    }
    if (url.includes('/submissions/')) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: 'unexpected call' }), { status: 500 });
  };
  return { fetchFn, calls };
}

function getSubmissionRequest(calls) {
  const call = calls.find((entry) => entry.url.includes('/submissions/'));
  assert.ok(call, 'expected a Canvas submissions API call');
  return JSON.parse(call.init.body || '{}');
}

test('canvasgradebook allows root user', async () => {
  const { fetchFn, calls } = buildFetchStub();
  const handler = createCanvasGradebookHandler({
    createSupabaseClientFromAuthHeader: () =>
      createMockSupabase({
        user: { id: 'u1', email: 'root@test.com' },
        roles: [{ user: 'u1', right: 'root', object: null }],
      }),
    getEnv: (key) => ({ SUPABASE_URL: 'x', SUPABASE_SERVICE_ROLE_KEY: 'y', CANVAS_API_KEY: 'z' })[key],
    fetchFn,
  });

  const response = await handler(
    makeRequest({
      courseId: '12345',
      topicType: 'project',
      percentCorrect: 90,
      pointsPossible: 100,
      learnerEmail: 'learner@test.com',
      canvasAssignmentId: 999,
      autoGrade: true,
    }),
  );

  assert.equal(response.status, 200);
  assert.equal(calls.length, 2);
  const submissionRequest = getSubmissionRequest(calls);
  assert.equal(submissionRequest.submission.posted_grade, 90);
  assert.ok(typeof submissionRequest.comment?.text_comment === 'string');
  assert.ok(submissionRequest.comment.text_comment.includes('MasteryLS feedback'));
  assert.ok(submissionRequest.comment.text_comment.includes('Suggested grade: 90/100 (90%)'));
});

test('canvasgradebook allows learner self-match', async () => {
  const { fetchFn, calls } = buildFetchStub();
  const handler = createCanvasGradebookHandler({
    createSupabaseClientFromAuthHeader: () =>
      createMockSupabase({
        user: { id: 'u2', email: 'learner@test.com' },
        roles: [],
      }),
    getEnv: (key) => ({ SUPABASE_URL: 'x', SUPABASE_SERVICE_ROLE_KEY: 'y', CANVAS_API_KEY: 'z' })[key],
    fetchFn,
  });

  const response = await handler(
    makeRequest({
      courseId: '12345',
      topicType: 'exam',
      percentCorrect: 80,
      pointsPossible: 200,
      learnerEmail: 'learner@test.com',
      canvasQuizId: 701,
    }),
  );

  assert.equal(response.status, 200);
  assert.equal(calls.length, 3);
  const submissionRequest = getSubmissionRequest(calls);
  assert.equal(submissionRequest.submission.posted_grade, 160);
  assert.ok(submissionRequest.comment.text_comment.includes('Suggested grade: 160/200 (80%)'));
});

test('canvasgradebook denies learner mismatch', async () => {
  const { fetchFn, calls } = buildFetchStub();
  const handler = createCanvasGradebookHandler({
    createSupabaseClientFromAuthHeader: () =>
      createMockSupabase({
        user: { id: 'u3', email: 'intruder@test.com' },
        roles: [],
      }),
    getEnv: (key) => ({ SUPABASE_URL: 'x', SUPABASE_SERVICE_ROLE_KEY: 'y', CANVAS_API_KEY: 'z' })[key],
    fetchFn,
  });

  const response = await handler(
    makeRequest({
      courseId: '12345',
      topicType: 'project',
      percentCorrect: 100,
      pointsPossible: 100,
      learnerEmail: 'learner@test.com',
      canvasAssignmentId: 888,
    }),
  );

  assert.equal(response.status, 403);
  assert.equal(calls.length, 0);
});

test('canvasgradebook can submit comment and url without posting grade when autoGrade is false', async () => {
  const { fetchFn, calls } = buildFetchStub();
  const handler = createCanvasGradebookHandler({
    createSupabaseClientFromAuthHeader: () =>
      createMockSupabase({
        user: { id: 'u5', email: 'learner@test.com' },
        roles: [],
      }),
    getEnv: (key) => ({ SUPABASE_URL: 'x', SUPABASE_SERVICE_ROLE_KEY: 'y', CANVAS_API_KEY: 'z' })[key],
    fetchFn,
  });

  const response = await handler(
    makeRequest({
      courseId: '12345',
      topicType: 'project',
      percentCorrect: 75,
      pointsPossible: 100,
      learnerEmail: 'learner@test.com',
      canvasAssignmentId: 888,
      autoGrade: false,
      feedback: 'Strong progress. Please tighten your introduction section.',
      submissionUrl: 'https://example.com/project',
    }),
  );

  assert.equal(response.status, 200);
  assert.equal(calls.length, 2);
  const submissionRequest = getSubmissionRequest(calls);
  assert.equal(submissionRequest.submission.posted_grade, undefined);
  assert.equal(submissionRequest.submission.submission_type, 'online_url');
  assert.equal(submissionRequest.submission.url, 'https://example.com/project');
  assert.ok(submissionRequest.comment.text_comment.includes('Suggested grade: 75/100 (75%)'));
  assert.ok(submissionRequest.comment.text_comment.includes('Feedback:'));
  assert.ok(submissionRequest.comment.text_comment.includes('Strong progress.'));
});

test('canvasgradebook denies editor for a different course', async () => {
  const { fetchFn, calls } = buildFetchStub();
  const handler = createCanvasGradebookHandler({
    createSupabaseClientFromAuthHeader: () =>
      createMockSupabase({
        user: { id: 'u4', email: 'editor@test.com' },
        roles: [{ user: 'u4', right: 'editor', object: '99999' }],
      }),
    getEnv: (key) => ({ SUPABASE_URL: 'x', SUPABASE_SERVICE_ROLE_KEY: 'y', CANVAS_API_KEY: 'z' })[key],
    fetchFn,
  });

  const response = await handler(
    makeRequest({
      courseId: '12345',
      topicType: 'project',
      percentCorrect: 100,
      pointsPossible: 100,
      learnerEmail: 'learner@test.com',
      canvasAssignmentId: 888,
    }),
  );

  assert.equal(response.status, 403);
  assert.equal(calls.length, 0);
});
