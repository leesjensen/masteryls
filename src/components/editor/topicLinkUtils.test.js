import assert from 'node:assert/strict';
import test from 'node:test';

import { relativeTopicPath, topicLinkDisplayPath, createTopicLinkMarkdown } from './topicLinkUtils.js';

const RAW = 'https://raw.githubusercontent.com/byucsstudent/masterylsdemo/main';

test('relativeTopicPath walks up and down between sibling topic folders', () => {
  assert.equal(relativeTopicPath(`${RAW}/instruction/introduction/introduction.md`, `${RAW}/instruction/example-links/example-links.md`), '../example-links/example-links.md');
});

test('relativeTopicPath from a repo-root file descends into a folder', () => {
  assert.equal(relativeTopicPath(`${RAW}/README.md`, `${RAW}/instruction/introduction/introduction.md`), 'instruction/introduction/introduction.md');
});

test('relativeTopicPath to a sibling file in the same folder is a bare file name', () => {
  assert.equal(relativeTopicPath(`${RAW}/something/more/topic1.md`, `${RAW}/something/more/topic2.md`), 'topic2.md');
});

test('relativeTopicPath returns null for different origins', () => {
  assert.equal(relativeTopicPath(`${RAW}/README.md`, 'https://example.com/main/other.md'), null);
});

test('relativeTopicPath returns null for a missing path', () => {
  assert.equal(relativeTopicPath('', `${RAW}/README.md`), null);
  assert.equal(relativeTopicPath(`${RAW}/README.md`, null), null);
});

test('relativeTopicPath to the same file yields its bare name (a valid self-link)', () => {
  assert.equal(relativeTopicPath(`${RAW}/README.md`, `${RAW}/README.md`), 'README.md');
});

test('topicLinkDisplayPath prefers the relative path and falls back to the raw path', () => {
  const topic = { id: 't2', title: 'Topic 2', path: `${RAW}/something/more/topic2.md` };
  assert.equal(topicLinkDisplayPath(`${RAW}/something/more/topic1.md`, topic), 'topic2.md');
  // No current topic path -> can't compute relative, show raw path.
  assert.equal(topicLinkDisplayPath('', topic), `${RAW}/something/more/topic2.md`);
});

test('createTopicLinkMarkdown inserts a relative link with the topic label', () => {
  const topic = { id: 't2', title: 'Topic 2', path: `${RAW}/something/more/topic2.md` };
  assert.equal(createTopicLinkMarkdown('course-1', topic, `${RAW}/something/more/topic1.md`), '[Topic 2](topic2.md)');
});

test('createTopicLinkMarkdown falls back to an absolute course link when no relative path is possible', () => {
  const topic = { id: 't2', title: 'Topic 2', path: 'https://example.com/other.md' };
  assert.equal(createTopicLinkMarkdown('course-1', topic, `${RAW}/README.md`), '[Topic 2](/course/course-1/topic/t2)');
});

test('createTopicLinkMarkdown returns empty string without a topic id', () => {
  assert.equal(createTopicLinkMarkdown('course-1', { title: 'x' }, `${RAW}/README.md`), '');
});
