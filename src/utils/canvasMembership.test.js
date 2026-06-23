import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvasCourseMembershipChecker } from '../hooks/canvas/canvasMembership.js';

test('canvas membership checker caches by course and learner', async () => {
  const calls = [];
  const checker = createCanvasCourseMembershipChecker({
    checkLearnerEligibility: async (params) => {
      calls.push(params);
      return { eligible: true };
    },
  });

  const first = await checker.isLearnerInCanvasCourse('12345', 'Bud@cow.com');
  const second = await checker.isLearnerInCanvasCourse('12345', 'bud@cow.com');

  assert.equal(first, true);
  assert.equal(second, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].courseId, '12345');
  assert.equal(calls[0].learnerEmail, 'bud@cow.com');
});

test('canvas membership checker dedupes in-flight requests', async () => {
  const calls = [];
  const checker = createCanvasCourseMembershipChecker({
    checkLearnerEligibility: async (params) => {
      calls.push(params);
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { eligible: true };
    },
  });

  const [first, second] = await Promise.all([checker.isLearnerInCanvasCourse('12345', 'bud@cow.com'), checker.isLearnerInCanvasCourse('12345', 'bud@cow.com')]);

  assert.equal(first, true);
  assert.equal(second, true);
  assert.equal(calls.length, 1);
});

test('canvas membership checker returns false when eligibility lookup says not eligible', async () => {
  const checker = createCanvasCourseMembershipChecker({
    checkLearnerEligibility: async () => ({ eligible: false }),
  });

  const result = await checker.isLearnerInCanvasCourse('12345', 'bud@cow.com');
  assert.equal(result, false);
});
