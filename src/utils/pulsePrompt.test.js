import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPulsePrompt } from './pulsePrompt.js';

test('pulse prompt specifies the standard evidence-first Markdown layout and previous pulse context', () => {
  const prompt = buildPulsePrompt({
    targetType: 'section',
    targetName: 'Section 1',
    term: { title: 'Fall Term' },
    currentEvidence: { enrollmentCount: 12 },
    previousPulse: 'Persistent concern: incomplete reading interactions.',
  });

  const headings = ['# Fall Term | Section 1 Pulse', '**Snapshot date:**', '## Overview', '## Status indicators', '## Change since the previous pulse', '## Positive signals', '## Needs attention', '## Priorities', '## Evidence notes'];
  let lastIndex = -1;
  for (const heading of headings) {
    const index = prompt.indexOf(heading);
    assert.ok(index > lastIndex, `${heading} should follow the prior standard section`);
    lastIndex = index;
  }
  assert.match(prompt, /Snapshot date:\*\* \d{4}-\d{2}-\d{2}/);
  assert.doesNotMatch(prompt, /> .*Snapshot date/);
  assert.match(prompt, /Persistent concern: incomplete reading interactions/);
  assert.match(prompt, /Course and section pulses may identify learners by name/);
  assert.match(prompt, /%%\{init:/);
  assert.match(prompt, /xychart-beta/);
  assert.match(prompt, /do not use pseudo-types such as line-chart/);
  assert.match(prompt, /Do not add classDef default/);
  assert.match(prompt, /Return Markdown only/);
});
