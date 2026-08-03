import test from 'node:test';
import assert from 'node:assert/strict';
import { getCanvasCourseUrl, getCanvasTopicUrl, hasCanvasTopicLink } from './canvasSync.js';

test('getCanvasCourseUrl builds the course page url', () => {
  assert.equal(getCanvasCourseUrl('12345'), 'https://byu.instructure.com/courses/12345');
});

test('getCanvasCourseUrl returns null without a course id', () => {
  assert.equal(getCanvasCourseUrl(''), null);
  assert.equal(getCanvasCourseUrl(undefined), null);
  assert.equal(getCanvasCourseUrl(null), null);
});

test('getCanvasTopicUrl links a linked page, quiz, or assignment topic', () => {
  assert.equal(getCanvasTopicUrl('12345', { externalRefs: { canvasPageId: 'intro' } }), 'https://byu.instructure.com/courses/12345/pages/intro');
  assert.equal(getCanvasTopicUrl('12345', { externalRefs: { canvasQuizId: 55 } }), 'https://byu.instructure.com/courses/12345/quizzes/55');
  assert.equal(getCanvasTopicUrl('12345', { externalRefs: { canvasAssignmentId: 77 } }), 'https://byu.instructure.com/courses/12345/assignments/77');
});

test('getCanvasTopicUrl returns null for an unlinked topic or missing course id', () => {
  assert.equal(getCanvasTopicUrl('12345', { externalRefs: {} }), null);
  assert.equal(getCanvasTopicUrl('12345', {}), null);
  assert.equal(getCanvasTopicUrl('', { externalRefs: { canvasPageId: 'intro' } }), null);
});

test('topic-or-course link precedence: topic url when linked, else course url', () => {
  const canvasCourseId = '12345';

  // Linked topic -> deep link to the topic (what the toolbar opens).
  const linkedTopic = { externalRefs: { canvasAssignmentId: 77 } };
  const linkedTarget = getCanvasTopicUrl(canvasCourseId, linkedTopic) || getCanvasCourseUrl(canvasCourseId);
  assert.equal(linkedTarget, 'https://byu.instructure.com/courses/12345/assignments/77');

  // Unlinked topic but linked course -> fall back to the course page.
  const unlinkedTopic = { externalRefs: {} };
  const unlinkedTarget = getCanvasTopicUrl(canvasCourseId, unlinkedTopic) || getCanvasCourseUrl(canvasCourseId);
  assert.equal(unlinkedTarget, 'https://byu.instructure.com/courses/12345');
});

test('hasCanvasTopicLink reflects whether a topic has any Canvas ref', () => {
  assert.equal(hasCanvasTopicLink({ externalRefs: { canvasPageId: 'intro' } }), true);
  assert.equal(hasCanvasTopicLink({ externalRefs: { canvasQuizId: 55 } }), true);
  assert.equal(hasCanvasTopicLink({ externalRefs: { canvasAssignmentId: 77 } }), true);
  assert.equal(hasCanvasTopicLink({ externalRefs: {} }), false);
  assert.equal(hasCanvasTopicLink({}), false);
});
