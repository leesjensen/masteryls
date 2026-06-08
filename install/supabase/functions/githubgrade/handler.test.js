import test from 'node:test';
import assert from 'node:assert/strict';
import { createGithubGradeHandler } from './handler.js';

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
  return new Request('https://local/functions/v1/githubgrade', {
    method: 'POST',
    headers: auth ? { Authorization: auth, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const defaultEnv = (key) => ({ SUPABASE_URL: 'x', SUPABASE_SERVICE_ROLE_KEY: 'y', GEMINI_API_KEY: 'gk' })[key];

function makeFetchRouter(routes) {
  const calls = [];
  const fetchFn = async (url, init) => {
    calls.push({ url: String(url), init });
    for (const [pattern, response] of routes) {
      if (pattern instanceof RegExp ? pattern.test(String(url)) : String(url) === pattern) {
        return typeof response === 'function' ? response(String(url), init) : response;
      }
    }
    throw new Error(`Unrouted fetch: ${url}`);
  };
  return { fetchFn, calls };
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

function textResponse(text, status = 200) {
  return new Response(text, { status, headers: { 'Content-Type': 'text/plain' } });
}

test('githubgrade returns 400 when url is missing', async () => {
  const handler = createGithubGradeHandler({
    createSupabaseClientFromAuthHeader: () => createMockSupabase({ user: { id: 'u1' } }),
    getEnv: defaultEnv,
    fetchFn: async () => {
      throw new Error('should not fetch');
    },
  });

  const response = await handler(makeRequest({ gradingCriteria: 'something' }));
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.match(body.error, /GitHub repository URL/i);
});

test('githubgrade rejects non-github URL', async () => {
  const handler = createGithubGradeHandler({
    createSupabaseClientFromAuthHeader: () => createMockSupabase({ user: { id: 'u1' } }),
    getEnv: defaultEnv,
    fetchFn: async () => {
      throw new Error('should not fetch');
    },
  });

  const response = await handler(makeRequest({ url: 'https://example.com/foo/bar', gradingCriteria: 'criteria' }));
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.match(body.error, /github.com\/owner\/repo/);
});

test('githubgrade returns friendly error when repo not found', async () => {
  const { fetchFn, calls } = makeFetchRouter([
    [/api\.github\.com\/repos\/u\/missing$/, new Response('not found', { status: 404 })],
  ]);

  const handler = createGithubGradeHandler({
    createSupabaseClientFromAuthHeader: () => createMockSupabase({ user: { id: 'u1' } }),
    getEnv: defaultEnv,
    fetchFn,
  });

  const response = await handler(makeRequest({ url: 'https://github.com/u/missing', gradingCriteria: 'c' }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.match(body.error, /not accessible/i);
  assert.equal(calls.length, 1, 'should not call further fetches after 404');
});

test('githubgrade happy path filters files and returns parsed grade', async () => {
  const tree = [
    { type: 'blob', path: 'README.md', size: 200 },
    { type: 'blob', path: 'src/app.js', size: 500 },
    { type: 'blob', path: 'src/styles.css', size: 300 },
    { type: 'blob', path: 'image.png', size: 5000 },
    { type: 'blob', path: 'node_modules/foo/index.js', size: 100 },
    { type: 'blob', path: 'big.js', size: 200 * 1024 },
  ];

  const { fetchFn, calls } = makeFetchRouter([
    [/api\.github\.com\/repos\/learner\/site$/, jsonResponse({ default_branch: 'main' })],
    [/api\.github\.com\/repos\/learner\/site\/git\/trees\/main/, jsonResponse({ tree })],
    [/raw\.githubusercontent\.com\/learner\/site\/main\/README\.md$/, textResponse('# Hello\nThis is the project README.')],
    [/raw\.githubusercontent\.com\/learner\/site\/main\/src\/app\.js$/, textResponse('console.log("hi")')],
    [/raw\.githubusercontent\.com\/learner\/site\/main\/src\/styles\.css$/, textResponse('body { color: red; }')],
    [/generativelanguage\.googleapis\.com/, jsonResponse({
      candidates: [{ content: { parts: [{ text: '{"percentCorrect": 85, "feedback": "Good structure. Improve docs."}' }] } }],
    })],
  ]);

  const handler = createGithubGradeHandler({
    createSupabaseClientFromAuthHeader: () => createMockSupabase({ user: { id: 'u1' } }),
    getEnv: defaultEnv,
    fetchFn,
  });

  const response = await handler(makeRequest({ url: 'https://github.com/learner/site', title: 'Website', body: 'Build a site.', gradingCriteria: 'Has README and CSS.' }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.percentCorrect, 85);
  assert.match(body.feedback, /Good structure/);
  assert.equal(body.filesIncluded, 3);
  assert.equal(body.branch, 'main');

  const fetchedPaths = calls.filter((c) => c.url.includes('raw.githubusercontent.com')).map((c) => c.url);
  assert.equal(fetchedPaths.length, 3, 'should fetch exactly the allowed files');
  assert.ok(!fetchedPaths.some((u) => u.includes('image.png')), 'should not fetch image.png');
  assert.ok(!fetchedPaths.some((u) => u.includes('node_modules')), 'should not fetch node_modules');
  assert.ok(!fetchedPaths.some((u) => u.endsWith('big.js')), 'should not fetch oversize file');
});

test('githubgrade honors total size cap and reports filesSkipped', async () => {
  const tree = [
    { type: 'blob', path: 'small.md', size: 1000 },
    { type: 'blob', path: 'a.js', size: 90_000 },
    { type: 'blob', path: 'b.js', size: 90_000 },
    { type: 'blob', path: 'c.js', size: 90_000 },
  ];

  const { fetchFn } = makeFetchRouter([
    [/api\.github\.com\/repos\/u\/r$/, jsonResponse({ default_branch: 'main' })],
    [/api\.github\.com\/repos\/u\/r\/git\/trees\/main/, jsonResponse({ tree })],
    [/raw\.githubusercontent\.com\/u\/r\/main\/.+/, () => textResponse('content')],
    [/generativelanguage\.googleapis\.com/, () => jsonResponse({
      candidates: [{ content: { parts: [{ text: '{"percentCorrect": 50, "feedback": "ok"}' }] } }],
    })],
  ]);

  const handler = createGithubGradeHandler({
    createSupabaseClientFromAuthHeader: () => createMockSupabase({ user: { id: 'u1' } }),
    getEnv: defaultEnv,
    fetchFn,
  });

  const response = await handler(makeRequest({ url: 'https://github.com/u/r', gradingCriteria: 'c' }));
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.filesIncluded, 3, 'small.md + 2 of the 90KB files fit under 200KB cap');
  assert.equal(body.filesSkipped, 1, 'one of the 90KB files is skipped');
});

test('githubgrade parses multi-line markdown feedback with fenced code blocks', async () => {
  const tree = [{ type: 'blob', path: 'README.md', size: 100 }];

  const detailedFeedback = [
    '## Summary',
    'The repository meets most criteria but lacks tests.',
    '',
    '## Strengths',
    '- Clear README structure in `README.md`:',
    '```md',
    '# Project',
    '## Setup',
    '```',
    '- Good docs intent.',
    '',
    '## Areas to improve',
    '- Add a test file (none present).',
    '- Document install steps in `README.md`.',
  ].join('\n');

  const geminiPayload = { percentCorrect: 78, feedback: detailedFeedback };

  const { fetchFn } = makeFetchRouter([
    [/api\.github\.com\/repos\/u\/r$/, jsonResponse({ default_branch: 'main' })],
    [/api\.github\.com\/repos\/u\/r\/git\/trees\/main/, jsonResponse({ tree })],
    [/raw\.githubusercontent\.com\/.+/, textResponse('# Project\n## Setup')],
    [/generativelanguage\.googleapis\.com/, jsonResponse({
      candidates: [{ content: { parts: [{ text: JSON.stringify(geminiPayload) }] } }],
    })],
  ]);

  const handler = createGithubGradeHandler({
    createSupabaseClientFromAuthHeader: () => createMockSupabase({ user: { id: 'u1' } }),
    getEnv: defaultEnv,
    fetchFn,
  });

  const response = await handler(makeRequest({ url: 'https://github.com/u/r', gradingCriteria: 'Has README' }));
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.percentCorrect, 78);
  assert.match(body.feedback, /## Strengths/);
  assert.match(body.feedback, /## Areas to improve/);
  assert.match(body.feedback, /```md\n# Project/);
});

test('githubgrade falls back to zero when AI response is unparseable', async () => {
  const tree = [{ type: 'blob', path: 'README.md', size: 50 }];

  const { fetchFn } = makeFetchRouter([
    [/api\.github\.com\/repos\/u\/r$/, jsonResponse({ default_branch: 'main' })],
    [/api\.github\.com\/repos\/u\/r\/git\/trees\/main/, jsonResponse({ tree })],
    [/raw\.githubusercontent\.com\/.+/, textResponse('text')],
    [/generativelanguage\.googleapis\.com/, jsonResponse({
      candidates: [{ content: { parts: [{ text: 'not json at all' }] } }],
    })],
  ]);

  const handler = createGithubGradeHandler({
    createSupabaseClientFromAuthHeader: () => createMockSupabase({ user: { id: 'u1' } }),
    getEnv: defaultEnv,
    fetchFn,
  });

  const response = await handler(makeRequest({ url: 'https://github.com/u/r', gradingCriteria: 'c' }));
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.percentCorrect, 0);
  assert.match(body.feedback, /Could not parse/i);
});
