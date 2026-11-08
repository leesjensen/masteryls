import test from 'node:test';
import assert from 'node:assert/strict';
import { fenceUnmarkedMermaid, normalizePulseMarkdown } from './pulseMarkdown.js';

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
