import assert from 'node:assert/strict';
import test from 'node:test';

import { parseMultipleChoiceBody } from './multipleChoiceInteraction.js';

test('parseMultipleChoiceBody extracts prompt and choices without feedback', () => {
  const body = `Which planet is closest to the sun?\n\n- [x] Mercury\n- [ ] Venus\n- [ ] Earth`;

  const parsed = parseMultipleChoiceBody(body);

  assert.equal(parsed.prompt, 'Which planet is closest to the sun?');
  assert.deepEqual(parsed.choices, [
    { text: 'Mercury', correct: true, feedback: '' },
    { text: 'Venus', correct: false, feedback: '' },
    { text: 'Earth', correct: false, feedback: '' },
  ]);
});

test('parseMultipleChoiceBody attaches indented feedback to the preceding choice', () => {
  const body = ['Acknowledge the syllabus.', '', '- [x] I have read this syllabus', '', "  Thanks for confirming - welcome aboard!", '', "- [ ] I'm ignoring the syllabus", '', '  Please review the syllabus before continuing.'].join('\n');

  const parsed = parseMultipleChoiceBody(body);

  assert.equal(parsed.choices[0].feedback, 'Thanks for confirming - welcome aboard!');
  assert.equal(parsed.choices[1].feedback, 'Please review the syllabus before continuing.');
});

test('parseMultipleChoiceBody preserves multiple feedback paragraphs', () => {
  const body = ['- [x] Yes', '  First paragraph line one.', '  First paragraph line two.', '', '  Second paragraph.', '- [ ] No'].join('\n');

  const parsed = parseMultipleChoiceBody(body);

  assert.equal(parsed.choices[0].feedback, 'First paragraph line one.\nFirst paragraph line two.\n\nSecond paragraph.');
  assert.equal(parsed.choices[1].feedback, '');
});

test('parseMultipleChoiceBody extracts the precomputed per-choice feedback the AI quiz generator emits', () => {
  // Mirrors the format aiQuizGenerator is prompted to produce: a two-space-indented feedback
  // paragraph under every choice, including the correct one.
  const body = [
    'What does the `const` keyword declare in JavaScript?',
    '',
    '- [ ] A variable that can be reassigned',
    '  Not quite - that describes `let`. `const` creates a binding that cannot be reassigned after it is initialized.',
    '- [x] A binding that cannot be reassigned',
    '  Correct! A `const` binding cannot be reassigned, though the value it points to may still be mutable.',
    '- [ ] A function declaration',
    '  Good try, but functions are declared with `function` or assigned to a binding. `const` declares a non-reassignable binding.',
    '- [ ] A global-only variable',
    '  Close, but scope is not what `const` controls - it is block-scoped like `let` and simply prevents reassignment.',
  ].join('\n');

  const parsed = parseMultipleChoiceBody(body);

  assert.equal(parsed.prompt, 'What does the `const` keyword declare in JavaScript?');
  assert.equal(parsed.choices.length, 4);
  assert.equal(parsed.choices[1].correct, true);
  assert.ok(parsed.choices.every((choice) => choice.feedback.length > 0));
  assert.match(parsed.choices[1].feedback, /^Correct!/);
});

test('parseMultipleChoiceBody ignores unindented lines after a choice', () => {
  const body = ['- [x] Yes', 'stray unindented line', '- [ ] No'].join('\n');

  const parsed = parseMultipleChoiceBody(body);

  assert.equal(parsed.choices[0].feedback, '');
  assert.equal(parsed.choices[1].feedback, '');
});
