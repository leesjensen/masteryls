import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveMarkdownHref } from './resolveMarkdownHref.js';

// A course whose topics live under a raw GitHub base. topicFromPath matches the way the real
// Course does: a topic whose `path` ends with the resolved path.
const topicPath = 'https://raw.githubusercontent.com/acct/repo/main/instruction/chess/chess.md';
const topics = [
  { id: 'chess-tips-id', path: 'https://raw.githubusercontent.com/acct/repo/main/instruction/chess-tips/chess-tips.md' },
  { id: 'overview-id', path: 'https://raw.githubusercontent.com/acct/repo/main/chess.md' },
];

function makeCtx(overrides = {}) {
  return {
    topicPath,
    courseId: 'course-1',
    // Mirrors Course.topicFromPath: a topic whose full path ends with the resolved path.
    topicFromPath: (path) => topics.find((t) => t.path.endsWith(path)) ?? null,
    resolveTopicUrl: (rawPath) => new URL(rawPath, topicPath).toString(),
    ...overrides,
  };
}

test('returns absolute http(s) hrefs unchanged', () => {
  const ctx = makeCtx();
  assert.equal(resolveMarkdownHref('https://cow.com', ctx), 'https://cow.com');
  assert.equal(resolveMarkdownHref('http://cow.com/a/b', ctx), 'http://cow.com/a/b');
});

test('returns root-relative hrefs unchanged', () => {
  assert.equal(resolveMarkdownHref('/course/abc/topic/def', makeCtx()), '/course/abc/topic/def');
});

test('returns a pure in-page anchor as-is', () => {
  assert.equal(resolveMarkdownHref('#phase-0---chess-moves', makeCtx()), '#phase-0---chess-moves');
});

test('handles nullish / empty href', () => {
  const ctx = makeCtx();
  assert.equal(resolveMarkdownHref(null, ctx), null);
  assert.equal(resolveMarkdownHref(undefined, ctx), undefined);
  assert.equal(resolveMarkdownHref('', ctx), '');
});

test('relative path to a course topic becomes a topic route', () => {
  // ../../instruction/chess-tips/chess-tips.md resolves to the chess-tips topic.
  assert.equal(resolveMarkdownHref('../../instruction/chess-tips/chess-tips.md', makeCtx()), '/course/course-1/topic/chess-tips-id');
});

test('relative topic link preserves a single (not doubled) anchor', () => {
  assert.equal(resolveMarkdownHref('../../instruction/chess-tips/chess-tips.md#phase-0---chess-moves', makeCtx()), '/course/course-1/topic/chess-tips-id#phase-0---chess-moves');
});

test('a sibling relative path resolves to its topic', () => {
  // ../chess.md from instruction/chess/chess.md -> instruction/chess.md ... not a topic here;
  // ../../chess.md -> repo/main/chess.md which is the overview topic.
  assert.equal(resolveMarkdownHref('../../chess.md', makeCtx()), '/course/course-1/topic/overview-id');
});

test('relative path to a non-topic resource becomes its absolute URL', () => {
  // main.java is a resource in the current topic's folder, not a topic.
  const resolved = resolveMarkdownHref('main.java', makeCtx());
  assert.equal(resolved, 'https://raw.githubusercontent.com/acct/repo/main/instruction/chess/main.java');
});

test('falls back to the raw href when the resource cannot be resolved to a URL', () => {
  // No resolveTopicUrl provided and not a topic -> return original href unchanged.
  const resolved = resolveMarkdownHref('main.java', makeCtx({ resolveTopicUrl: undefined }));
  assert.equal(resolved, 'main.java');
});

test('does not throw when session context is missing', () => {
  assert.equal(resolveMarkdownHref('../chess.md', {}), '../chess.md');
});
