import test from 'node:test';
import assert from 'node:assert/strict';
import { convertMathDelimitersToInlineCode } from './inlineCodeMarkdown.js';

test('converts LaTeX inline variables to backticked code', () => {
  assert.equal(
    convertMathDelimitersToInlineCode('You can pick any two different inputs ($m_1$ and $m_2$) that collide.'),
    'You can pick any two different inputs (`m_1` and `m_2`) that collide.',
  );
});

test('converts function and complexity notation', () => {
  assert.equal(convertMathDelimitersToInlineCode('The hash $H(m)$ runs in $O(n log n)$ time.'), 'The hash `H(m)` runs in `O(n log n)` time.');
  assert.equal(convertMathDelimitersToInlineCode('Let $x^2$ and $\\alpha$ be given.'), 'Let `x^2` and `\\alpha` be given.');
});

test('converts display math $$...$$', () => {
  assert.equal(convertMathDelimitersToInlineCode('The identity $$a^2 + b^2$$ holds.'), 'The identity `a^2 + b^2` holds.');
});

test('leaves currency and plain prose dollars untouched', () => {
  assert.equal(convertMathDelimitersToInlineCode('It costs $5 and $10 total.'), 'It costs $5 and $10 total.');
  assert.equal(convertMathDelimitersToInlineCode('Ranges like $5-$10 are common.'), 'Ranges like $5-$10 are common.');
});

test('leaves fenced code blocks and existing inline code verbatim', () => {
  const fenced = 'Before\n```js\nconst a = $x$; // keep\n```\nAfter $m_1$.';
  assert.equal(convertMathDelimitersToInlineCode(fenced), 'Before\n```js\nconst a = $x$; // keep\n```\nAfter `m_1`.');
  assert.equal(convertMathDelimitersToInlineCode('Keep `$m_1$` as-is but fix $m_2$.'), 'Keep `$m_1$` as-is but fix `m_2`.');
});

test('is safe on empty/nullish input', () => {
  assert.equal(convertMathDelimitersToInlineCode(''), '');
  assert.equal(convertMathDelimitersToInlineCode(null), '');
});
