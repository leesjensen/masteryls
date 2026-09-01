import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveInteractionHref } from './interactionHrefResolver.js';

// Course topics carry `main`-pinned raw URLs (that is what Course.topicFromPath matches against).
const RAW_MAIN = 'https://raw.githubusercontent.com/softwareconstruction240/softwareconstruction/main';
const topics = [
  { id: 'chess-repo-topic', path: `${RAW_MAIN}/chess/chess-github-repository/chess-github-repository.md` },
  { id: 'chess-topic', path: `${RAW_MAIN}/chess/chess/chess.md` },
];

// The currently loaded topic's content is fetched from a SHA-pinned snapshot URL, so its
// snapshotPath differs from its `main`-pinned path - exactly the production case that broke.
const SHA = '560a7b881f4ccf6c94f6a9851fc17caa1ce468f9';
function makeSession() {
  return {
    course: {
      id: 'course-1',
      // Mirrors Course.topicFromPath: a topic whose full path ends with the resolved path.
      topicFromPath: (path, _fallback) => topics.find((t) => t.path.endsWith(path)) ?? null,
    },
    topic: {
      id: 'chess-topic',
      path: `${RAW_MAIN}/chess/chess/chess.md`,
      snapshotPath: `https://raw.githubusercontent.com/softwareconstruction240/softwareconstruction/${SHA}/chess/chess/chess.md`,
    },
  };
}

test('resolves a relative link to a topic route using the main-pinned path (not the SHA snapshot)', () => {
  // This is the reported bug: from chess/chess/chess.md, ../chess-github-repository/... must map
  // to the chess-repo topic. Resolving against the SHA snapshotPath would miss the match and
  // open the raw .md instead.
  const resolved = resolveInteractionHref('../chess-github-repository/chess-github-repository.md', makeSession());
  assert.equal(resolved, '/course/course-1/topic/chess-repo-topic');
});

test('preserves an anchor on a resolved topic link', () => {
  const resolved = resolveInteractionHref('../chess-github-repository/chess-github-repository.md#setup', makeSession());
  assert.equal(resolved, '/course/course-1/topic/chess-repo-topic#setup');
});

test('a non-topic resource falls back to the SHA-pinned snapshot URL', () => {
  // Resources (actual file fetches) SHOULD use the snapshot path so the pinned revision is read.
  const resolved = resolveInteractionHref('./diagram.png', makeSession());
  assert.equal(resolved, `https://raw.githubusercontent.com/softwareconstruction240/softwareconstruction/${SHA}/chess/chess/diagram.png`);
});

test('absolute and root-relative hrefs pass through unchanged', () => {
  const session = makeSession();
  assert.equal(resolveInteractionHref('https://cow.com', session), 'https://cow.com');
  assert.equal(resolveInteractionHref('/course/abc/topic/def', session), '/course/abc/topic/def');
});

test('a pure in-page anchor is returned as-is', () => {
  assert.equal(resolveInteractionHref('#getting-started', makeSession()), '#getting-started');
});

test('does not throw when the session or topic is missing', () => {
  assert.equal(resolveInteractionHref('../foo.md', undefined), '../foo.md');
  assert.equal(resolveInteractionHref('../foo.md', {}), '../foo.md');
});
