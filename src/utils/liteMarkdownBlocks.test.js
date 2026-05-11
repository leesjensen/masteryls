import assert from 'node:assert/strict';
import test from 'node:test';

import { parseLiteMarkdownBlocks } from './liteMarkdownBlocks.js';

test('parseLiteMarkdownBlocks returns empty array for empty input', () => {
  assert.deepEqual(parseLiteMarkdownBlocks(''), []);
  assert.deepEqual(parseLiteMarkdownBlocks(null), []);
});

test('parseLiteMarkdownBlocks parses paragraphs and unordered lists', () => {
  const input = ['Strengths:', '', '* First', '* Second', '', 'Wrap up paragraph.'].join('\n');

  assert.deepEqual(parseLiteMarkdownBlocks(input), [
    { type: 'p', text: 'Strengths:' },
    { type: 'ul', items: ['First', 'Second'] },
    { type: 'p', text: 'Wrap up paragraph.' },
  ]);
});

test('parseLiteMarkdownBlocks collapses blank lines between adjacent bullet items', () => {
  const input = ['* First item', '', '* Second item', '', '* Third item'].join('\n');

  assert.deepEqual(parseLiteMarkdownBlocks(input), [{ type: 'ul', items: ['First item', 'Second item', 'Third item'] }]);
});

test('parseLiteMarkdownBlocks supports -, +, and * list markers', () => {
  const input = ['- One', '+ Two', '* Three'].join('\n');

  assert.deepEqual(parseLiteMarkdownBlocks(input), [{ type: 'ul', items: ['One', 'Two', 'Three'] }]);
});
