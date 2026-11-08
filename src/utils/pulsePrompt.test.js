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
    pulseTrendHistory: [{ snapshotDate: '2026-11-06', masteryPercent: 40 }, { snapshotDate: '2026-11-07', masteryPercent: 42 }],
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
  assert.match(prompt, /Use every comparable point in PULSE TREND HISTORY, in chronological order, plus the current evidence/);
  assert.match(prompt, /2026-11-06/);
  assert.match(prompt, /put them in separate charts with appropriate independent axes/);
  assert.match(prompt, /Course and section pulses may identify learners by name/);
  assert.match(prompt, /exclude users with editor or mentor roles for this course/);
  assert.match(prompt, /older pulses without a cohort marker included course staff and are not comparable/);
  assert.match(prompt, /attendance session counts and response tallies/);
  assert.match(prompt, /Canvas current overall grades are the learners' current course standing/);
  assert.match(prompt, /Use only `sources\.schedule\.deadlines` for course schedule dates/);
  assert.match(prompt, /when `scheduleDate` is present, use that date and never substitute the Canvas date/);
  assert.match(prompt, /Revalidate every date from an earlier pulse against the current schedule evidence/);
  assert.match(prompt, /progress events, attendance sessions, and scheduled assignments are limited to the selected term/);
  assert.match(prompt, /%%\{init:/);
  assert.match(prompt, /entire diagram source in a fenced Markdown code block/);
  assert.match(prompt, /Never output Mermaid directives or diagram declarations as unfenced Markdown/);
  assert.match(prompt, /xychart-beta/);
  assert.match(prompt, /do not use pseudo-types such as line-chart/);
  assert.match(prompt, /Do not add classDef default/);
  assert.match(prompt, /Return Markdown only/);
});
