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

  // Ongoing threads sits between Priorities and Evidence notes.
  const headings = ['## Overview', '## Status indicators', '## Change since the previous pulse', '## Positive signals', '## Needs attention', '## Priorities', '## Ongoing threads', '## Evidence notes'];
  let lastIndex = -1;
  for (const heading of headings) {
    const index = prompt.indexOf(heading);
    assert.ok(index > lastIndex, `${heading} should follow the prior standard section`);
    lastIndex = index;
  }

  assert.match(prompt, /A lead summary: one or two sentences, at most 180 characters/);
  assert.match(prompt, /Do not add a top-level title heading or a snapshot-date line/);
  assert.doesNotMatch(prompt, /# Fall Term \| Section 1 Pulse/);

  // Mastery is the single progress metric; completed topics are gone.
  assert.match(prompt, /topic mastery \(percent\)\*\* as the single progress metric/);
  assert.match(prompt, /do NOT include a completed-topics row/);

  // The chart is inserted programmatically via a placeholder; the model authors no diagram.
  assert.match(prompt, /Do NOT author any Mermaid, xychart, or other diagram/);
  assert.match(prompt, /\{\{MASTERY_TREND_CHART\}\}/);
  assert.doesNotMatch(prompt, /classDef default/);
  assert.doesNotMatch(prompt, /pseudo-types/);
  assert.doesNotMatch(prompt, /current evidence point's snapshot date is/);

  // The carried-forward Ongoing threads ledger (long-term memory) and the since-last-pulse focus.
  assert.match(prompt, /running, carried-forward ledger of multi-pulse objectives and issues/);
  assert.match(prompt, /Start from the previous pulse's "## Ongoing threads"/);
  assert.match(prompt, /never drop an unresolved one/);
  assert.match(prompt, /Flag as \*\*escalating\*\* anything that has persisted across multiple pulses/);
  assert.match(prompt, /focused on what has changed or happened SINCE the last pulse/);

  assert.match(prompt, /Persistent concern: incomplete reading interactions/);
  assert.match(prompt, /2026-11-06/);
  assert.match(prompt, /Course and section pulses may identify learners by name/);
  assert.match(prompt, /exclude users with editor or mentor roles for this course/);
  assert.match(prompt, /older pulses without a cohort marker included course staff and are not comparable/);
  assert.match(prompt, /attendance session counts and response tallies/);
  assert.match(prompt, /Canvas current overall grades are the learners' current course standing/);
  assert.match(prompt, /Use only `sources\.schedule\.deadlines` for course schedule dates/);
  assert.match(prompt, /Canvas `canvasDueDate` is normalized to the course calendar in `America\/Denver`/);
  assert.match(prompt, /Revalidate every date from an earlier pulse against the current schedule evidence/);
  assert.match(prompt, /progress events, attendance sessions, and scheduled assignments are limited to the selected term/);
  assert.match(prompt, /Return Markdown only/);

  assert.match(prompt, /Write for a course overseer .* in the third person/);
  assert.doesNotMatch(prompt, /Write the body directly to the learner in the second person/);
});

test('learner pulse prompt is written directly to the learner in the second person', () => {
  const prompt = buildPulsePrompt({
    targetType: 'learner',
    targetName: 'Jordan Lee',
    term: { title: 'Fall Term' },
    currentEvidence: { masteryPercent: 75 },
    previousPulse: '',
    pulseTrendHistory: [],
  });

  assert.match(prompt, /Write the body directly to the learner in the second person \("you", "your"\)/);
  assert.match(prompt, /Do not refer to the learner in the third person/);
  assert.match(prompt, /learner-specific Canvas effective due date as the date of record/);
  assert.match(prompt, /Mention a Canvas extension only when the current Canvas assignment evidence explicitly has `dueDateAdjustment: "later"`/);
  assert.match(prompt, /If that field is absent, do not say or imply that Canvas granted an extension/);
  assert.match(prompt, /## Ongoing threads/);
  assert.match(prompt, /\{\{MASTERY_TREND_CHART\}\}/);
  assert.doesNotMatch(prompt, /Write for a course overseer/);
  assert.doesNotMatch(prompt, /# Fall Term \| Jordan Lee Pulse/);
});
