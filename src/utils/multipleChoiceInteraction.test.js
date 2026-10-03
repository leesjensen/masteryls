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

test('parseMultipleChoiceBody ignores unindented lines after a choice', () => {
  const body = ['- [x] Yes', 'stray unindented line', '- [ ] No'].join('\n');

  const parsed = parseMultipleChoiceBody(body);

  assert.equal(parsed.choices[0].feedback, '');
  assert.equal(parsed.choices[1].feedback, '');
});
