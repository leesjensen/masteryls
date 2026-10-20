import test from 'node:test';
import assert from 'node:assert/strict';
import { headingSlug } from './headingSlug.js';
import { parseTopicHeadings } from './topicHeadings.js';

test('headingSlug lowercases, hyphenates whitespace, and drops non-word characters', () => {
  assert.equal(headingSlug('Getting Started'), 'getting-started');
  assert.equal(headingSlug('Step 1: Setup!'), 'step-1-setup');
  assert.equal(headingSlug('  Spaced   Out  '), '-spaced-out-'); // leading/inner/trailing ws -> hyphens
  assert.equal(headingSlug(null), '');
});

test('parseTopicHeadings collects level-2 headings in order with matching slugs', () => {
  const md = ['# Title', '', 'Intro text', '', '## Overview', 'body', '## Getting Started', 'more'].join('\n');
  assert.deepEqual(parseTopicHeadings(md), [
    { text: 'Overview', slug: 'overview' },
    { text: 'Getting Started', slug: 'getting-started' },
  ]);
});

test('parseTopicHeadings ignores h1, h3+, and setext underlines', () => {
  const md = ['# One', '## Two', '### Three', '#### Four', 'Underline', '---'].join('\n');
  assert.deepEqual(
    parseTopicHeadings(md).map((h) => h.text),
    ['Two'],
  );
});

test('parseTopicHeadings skips headings inside fenced code blocks (``` and ~~~)', () => {
  const md = ['## Real', '```js', '## not a heading', '```', '~~~', '## also not', '~~~', '## Also Real'].join('\n');
  assert.deepEqual(
    parseTopicHeadings(md).map((h) => h.text),
    ['Real', 'Also Real'],
  );
});

test('parseTopicHeadings skips masteryls interaction blocks', () => {
  const md = ['## Quiz', '```masteryls', '{"type":"multiple-choice"}', '## trap', '```', '## After'].join('\n');
  assert.deepEqual(
    parseTopicHeadings(md).map((h) => h.text),
    ['Quiz', 'After'],
  );
});

test('parseTopicHeadings strips inline markdown so the slug matches the rendered heading id', () => {
  const md = ['## The **bold** `code` and _em_', '## A [linked](https://x.com) word', '## ![img](p.png) Picture'].join('\n');
  assert.deepEqual(parseTopicHeadings(md), [
    { text: 'The bold code and em', slug: 'the-bold-code-and-em' },
    { text: 'A linked word', slug: 'a-linked-word' },
    { text: 'Picture', slug: 'picture' },
  ]);
});

test('parseTopicHeadings strips an optional trailing closing-hash sequence', () => {
  assert.deepEqual(parseTopicHeadings('## Heading ##').map((h) => h.text), ['Heading']);
});

test('parseTopicHeadings tolerates empty/missing input', () => {
  assert.deepEqual(parseTopicHeadings(''), []);
  assert.deepEqual(parseTopicHeadings(null), []);
});
