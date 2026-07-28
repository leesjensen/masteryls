import assert from 'node:assert/strict';
import test from 'node:test';

import { markdownToHtml } from './markdownToHtml.js';

test('markdownToHtml returns empty string for nullish input', () => {
  assert.equal(markdownToHtml(null), '');
  assert.equal(markdownToHtml(undefined), '');
  assert.equal(markdownToHtml(''), '');
});

test('markdownToHtml converts newlines to <br>', () => {
  assert.equal(markdownToHtml('line one\nline two'), 'line one<br>line two');
});

test('markdownToHtml converts blank lines to a double break', () => {
  assert.equal(markdownToHtml('a\n\nb'), 'a<br><br>b');
});

test('markdownToHtml converts headings of any level to bold labels', () => {
  assert.equal(markdownToHtml('# Title'), '<strong>Title</strong>');
  assert.equal(markdownToHtml('#### Summary'), '<strong>Summary</strong>');
});

test('markdownToHtml strips trailing hashes from closed-style headings', () => {
  assert.equal(markdownToHtml('## Strengths ##'), '<strong>Strengths</strong>');
});

test('markdownToHtml puts a heading on its own line above its content', () => {
  assert.equal(markdownToHtml('#### Summary\nThe work is solid.'), '<strong>Summary</strong><br>The work is solid.');
});

test('markdownToHtml does not treat a bare # without text as a heading', () => {
  assert.equal(markdownToHtml('#nofollow'), '#nofollow');
});

test('markdownToHtml converts bold to <strong>', () => {
  assert.equal(markdownToHtml('This is **bold** and __also bold__.'), 'This is <strong>bold</strong> and <strong>also bold</strong>.');
});

test('markdownToHtml groups consecutive bullets into a single <ul>', () => {
  assert.equal(markdownToHtml('- one\n- two\n* three'), '<ul><li>one</li><li>two</li><li>three</li></ul>');
});

test('markdownToHtml applies bold inside bullet items', () => {
  assert.equal(markdownToHtml('- **done**'), '<ul><li><strong>done</strong></li></ul>');
});

test('markdownToHtml escapes HTML-significant characters in text', () => {
  assert.equal(markdownToHtml('use a < b && c > d'), 'use a &lt; b &amp;&amp; c &gt; d');
});

test('markdownToHtml escapes markup that appears in feedback so it cannot inject tags', () => {
  const out = markdownToHtml('<script>alert(1)</script>');
  assert.ok(out.includes('&lt;script&gt;'));
  assert.ok(!out.includes('<script>'));
});

test('markdownToHtml separates a bullet list from surrounding text', () => {
  assert.equal(markdownToHtml('Strengths\n- clean code\nAreas to improve'), 'Strengths<br><ul><li>clean code</li></ul><br>Areas to improve');
});

test('markdownToHtml converts inline code and removes the backtick delimiters', () => {
  assert.equal(markdownToHtml('Edit `README.md` now'), 'Edit <code>README.md</code> now');
});

test('markdownToHtml converts fenced code blocks to <pre> with escaped content', () => {
  const out = markdownToHtml('```jsx\n<rect x="10" />\n```');
  assert.equal(out, '<pre>&lt;rect x="10" /&gt;</pre>');
});

test('markdownToHtml removes stray unpaired backticks so Canvas cannot start ASCIIMath', () => {
  assert.equal(markdownToHtml('orphan ` here'), 'orphan  here');
});

test('markdownToHtml leaves no backtick outside a code block in realistic feedback', () => {
  const feedback = ['Review `notes.md`:', '```markdown', '- [x] Backend `endpoints`', '```', 'Use `index` carefully.'].join('\n');
  const out = markdownToHtml(feedback);
  // Backticks inside <pre> are inert (MathJax skips <pre>); none may remain in prose.
  const outsideCode = out.replace(/<pre>[\s\S]*?<\/pre>/g, '');
  assert.ok(!outsideCode.includes('`'));
  assert.ok(out.includes('<code>notes.md</code>'));
});

test('markdownToHtml leaves plain text untouched', () => {
  assert.equal(markdownToHtml('Just a normal sentence.'), 'Just a normal sentence.');
});
