import test from 'node:test';
import assert from 'node:assert/strict';
import { fenceUnmarkedMermaid, normalizePulseMarkdown, pulseSummaryText } from './pulseMarkdown.js';

test('wraps raw Mermaid directive and chart source in a mermaid fence', () => {
  const input = `## Trend\n%%{init: { 'theme': 'neutral' }}%%\nxychart-beta\n    title "Mastery trend"\n    x-axis ["Previous", "Current"]\n    line [41, 44]\n\n* Growth increased.`;
  const result = fenceUnmarkedMermaid(input);

  assert.match(result, /## Trend\n```mermaid\n%%\{init:/);
  assert.match(result, /line \[41, 44\]\n```\n\n\* Growth increased\./);
});

test('preserves already fenced Mermaid and does not fence ordinary code', () => {
  const input = '```mermaid\nflowchart TD\n A-->B\n```\n\n```text\nxychart-beta\n```';
  assert.equal(fenceUnmarkedMermaid(input), input);
});

test('normalizes legacy snapshot date quotes and unfenced Mermaid together', () => {
  const result = normalizePulseMarkdown('> **Snapshot date:** 2026-11-07\n\nflowchart TD\n A-->B');
  assert.match(result, /\*\*Snapshot date:\*\* 2026-11-07/);
  assert.match(result, /```mermaid\nflowchart TD\n A-->B\n```/);
});

test('pulseSummaryText strips Markdown, metadata, fences and tables into plain prose', () => {
  const input = [
    '# Weekly Pulse',
    '**Snapshot date:** 2026-11-07',
    '',
    "You're making **steady** progress on [the project](http://x). Keep it up!",
    '',
    '```mermaid',
    'flowchart TD',
    '  A-->B',
    '```',
    '',
    '| Metric | Value |',
    '| --- | --- |',
    '| Mastery | 44 |',
  ].join('\n');
  const result = pulseSummaryText(input);
  assert.equal(result, "You're making steady progress on the project. Keep it up!");
  assert.ok(!/Weekly Pulse|Snapshot date|mermaid|flowchart|Mastery/.test(result));
});

test('pulseSummaryText truncates long prose on a word boundary with an ellipsis', () => {
  const words = Array.from({ length: 80 }, (_, i) => `word${i}`).join(' ');
  const result = pulseSummaryText(words, 40);
  assert.ok(result.length <= 41);
  assert.ok(result.endsWith('…'));
  assert.ok(!/word\d+…$/.test(result) || result.endsWith(' …') === false); // truncated at a boundary, not mid-word
});

test('pulseSummaryText prefers the lead summary paragraph over the Overview', () => {
  const input = [
    'You have a strong technical foundation and are progressing through GitHub Pages.',
    '',
    '## Overview',
    'You have established a solid conceptual foundation in several technical areas and are actively working through the materials.',
    '',
    '## Status indicators',
    '| Metric | Value |',
    '| --- | --- |',
    '| Topic Mastery | 9% |',
  ].join('\n');
  assert.equal(pulseSummaryText(input), 'You have a strong technical foundation and are progressing through GitHub Pages.');
});

test('pulseSummaryText falls back to the Overview body when there is no lead summary', () => {
  const input = ['# Weekly Pulse', '', '## Overview', 'Overview body prose here.', '', '## Positive signals', '* Great job'].join('\n');
  assert.equal(pulseSummaryText(input), 'Overview body prose here.');
});

test('pulseSummaryText falls back to any body prose when there is no lead or Overview', () => {
  const input = '# Checking in on your progress\n\nYou have a clear next step in the course.';
  assert.equal(pulseSummaryText(input), 'You have a clear next step in the course.');
});

test('pulseSummaryText is safe on empty/nullish input', () => {
  assert.equal(pulseSummaryText(''), '');
  assert.equal(pulseSummaryText(null), '');
  assert.equal(pulseSummaryText(undefined), '');
});
