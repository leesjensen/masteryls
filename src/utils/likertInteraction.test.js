import assert from 'node:assert/strict';
import test from 'node:test';

import { canViewLikertResults, parseLikertBody, parseLikertScale, summarizeLikertResponses } from './likertInteraction.js';

test('parseLikertScale supports ordered label-only Scale line tokens', () => {
  const scale = parseLikertScale('Scale: Strongly disagree | Disagree | Neutral | Agree | Strongly agree');

  assert.deepEqual(scale.values, [1, 2, 3, 4, 5]);
  assert.equal(scale.labels[1], 'Strongly disagree');
  assert.equal(scale.labels[5], 'Strongly agree');
});

test('parseLikertBody extracts prompt and qid/item rows', () => {
  const body = `Please rate each statement.\n\nScale: Strongly disagree | Disagree | Neutral | Agree | Strongly agree\n\n| qid | item |\n|-----|------|\n| prep | I came prepared for class. |\n| engage | I stayed engaged. |`;

  const parsed = parseLikertBody(body);

  assert.equal(parsed.prompt, 'Please rate each statement.');
  assert.equal(parsed.questions.length, 2);
  assert.equal(parsed.questions[0].qid, 'prep');
  assert.equal(parsed.questions[1].text, 'I stayed engaged.');
  assert.deepEqual(parsed.scale.values, [1, 2, 3, 4, 5]);
});

test('parseLikertBody falls back to meta scale settings', () => {
  const body = `Rate each line.\n\n| id | statement |\n|---|---|\n| q1 | Example item |`;
  const parsed = parseLikertBody(body, {
    scaleMin: 0,
    scaleMax: 2,
    scaleLabels: {
      0: 'No',
      1: 'Maybe',
      2: 'Yes',
    },
  });

  assert.deepEqual(parsed.scale.values, [0, 1, 2]);
  assert.equal(parsed.scale.labels[0], 'No');
  assert.equal(parsed.scale.labels[2], 'Yes');
});

test('summarizeLikertResponses aggregates averages and distributions', () => {
  const summary = summarizeLikertResponses({
    questions: [
      { qid: 'prep', text: 'Prepared' },
      { qid: 'engage', text: 'Engaged' },
    ],
    scaleValues: [1, 2, 3, 4, 5],
    latestResponsesByUser: [{ responses: { prep: 4, engage: 5 } }, { responses: { prep: 2, engage: 3 } }, { responses: { prep: 4 } }],
  });

  assert.equal(summary.voters, 3);
  assert.equal(summary.overallAverage, 3.6);
  assert.equal(summary.questions[0].responses, 3);
  assert.equal(summary.questions[0].counts[4], 2);
  assert.equal(summary.questions[0].average, 3.33);
  assert.equal(summary.questions[1].responses, 2);
  assert.equal(summary.questions[1].counts[5], 1);
});

test('canViewLikertResults allows all users when showResults=always', () => {
  assert.equal(canViewLikertResults('always', null), true);
  assert.equal(canViewLikertResults('always', {}), true);
});

test('canViewLikertResults restricts editor mode to editor/root users', () => {
  const rootUser = { isRoot: () => true, isEditor: () => false };
  const editorUser = { isRoot: () => false, isEditor: () => true };
  const learnerUser = { isRoot: () => false, isEditor: () => false };

  assert.equal(canViewLikertResults('editor', rootUser), true);
  assert.equal(canViewLikertResults('editor', editorUser), true);
  assert.equal(canViewLikertResults('editor', learnerUser), false);
  assert.equal(canViewLikertResults('editor', null), false);
});
