import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMasteryTrendChart, insertMasteryTrendChart, MASTERY_TREND_PLACEHOLDER } from './pulseMasteryChart.js';

test('buildMasteryTrendChart plots every point as a bar with a fixed 0–100 axis and palette', () => {
  const chart = buildMasteryTrendChart(
    [
      { date: '2026-11-06', mastery: 42 },
      { date: '2026-11-08', mastery: 45.9 },
      { date: '2026-11-10', mastery: 47.3 },
    ],
    { title: 'Average Cumulative Mastery (%)' },
  );
  assert.match(chart, /^```mermaid\n/);
  assert.match(chart, /\n```$/);
  assert.match(chart, /'plotColorPalette':\s+'#4a95e0ff, #96d21dff, #eea717ff'/);
  assert.match(chart, /xychart-beta/);
  assert.match(chart, /title "Average Cumulative Mastery \(%\)"/);
  assert.match(chart, /x-axis \["2026-11-06", "2026-11-08", "2026-11-10"\]/);
  assert.match(chart, /y-axis "Mastery \(%\)" 0 --> 100/);
  assert.match(chart, /%% blue bar\n {4}bar \[42, 45.9, 47.3\]/);
  assert.doesNotMatch(chart, /\n {4}line \[/);
});

test('buildMasteryTrendChart dedupes same-day points (last wins) and sorts chronologically', () => {
  const chart = buildMasteryTrendChart([
    { date: '2026-11-10', mastery: 47.3 },
    { date: '2026-11-06', mastery: 42 },
    { date: '2026-11-10', mastery: 48 }, // current value for the same day overrides the prior
  ]);
  assert.match(chart, /x-axis \["2026-11-06", "2026-11-10"\]/);
  assert.match(chart, /bar \[42, 48\]/);
});

test('buildMasteryTrendChart returns empty for fewer than two plottable points', () => {
  assert.equal(buildMasteryTrendChart([{ date: '2026-11-10', mastery: 47 }]), '');
  assert.equal(buildMasteryTrendChart([]), '');
  assert.equal(buildMasteryTrendChart([{ date: 'bad', mastery: 1 }, { date: '2026-11-10', mastery: null }]), '');
});

test('buildMasteryTrendChart keeps the 0–100 axis even when all values are equal', () => {
  const chart = buildMasteryTrendChart([
    { date: '2026-11-08', mastery: 50 },
    { date: '2026-11-10', mastery: 50 },
  ]);
  assert.match(chart, /y-axis "Mastery \(%\)" 0 --> 100/);
  assert.match(chart, /bar \[50, 50\]/);
});

test('insertMasteryTrendChart replaces the placeholder with the chart', () => {
  const md = `## Status indicators\n| x | y |\n\n${MASTERY_TREND_PLACEHOLDER}\n\n## Change since the previous pulse\nbody`;
  const out = insertMasteryTrendChart(md, '```mermaid\nCHART\n```');
  assert.match(out, /\| x \| y \|\n\n```mermaid\nCHART\n```\n\n## Change/);
  assert.ok(!out.includes(MASTERY_TREND_PLACEHOLDER));
});

test('insertMasteryTrendChart removes the placeholder when there is no chart', () => {
  const md = `## Status indicators\n| x | y |\n\n${MASTERY_TREND_PLACEHOLDER}\n\n## Change\nbody`;
  const out = insertMasteryTrendChart(md, '');
  assert.ok(!out.includes(MASTERY_TREND_PLACEHOLDER));
  assert.match(out, /\| x \| y \|\n\n## Change/);
});

test('insertMasteryTrendChart falls back to after Status indicators when the placeholder is missing', () => {
  const md = `## Overview\nintro\n\n## Status indicators\n| x | y |\n| - | - |\n\n## Change since the previous pulse\nbody`;
  const out = insertMasteryTrendChart(md, '```mermaid\nCHART\n```');
  assert.match(out, /\| - \| - \|\n\n```mermaid\nCHART\n```\n\n## Change since the previous pulse/);
});

test('insertMasteryTrendChart leaves markdown unchanged when there is no placeholder and no chart', () => {
  const md = '## Overview\nintro';
  assert.equal(insertMasteryTrendChart(md, ''), md);
});
