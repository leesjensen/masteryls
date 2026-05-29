import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvasCourseMembershipChecker } from '../hooks/canvas/canvasMembership.js';

test('canvas membership checker caches by course and learner', async () => {
  const calls = [];
  const checker = createCanvasCourseMembershipChecker({
    makeCanvasApiRequest: async (endpoint) => {
      calls.push(endpoint);
      return [{ id: 1, email: 'bud@cow.com', login_id: 'bud@cow.com' }];
    },
  });

  const first = await checker.isLearnerInCanvasCourse('12345', 'Bud@cow.com');
  const second = await checker.isLearnerInCanvasCourse('12345', 'bud@cow.com');

  assert.equal(first, true);
  assert.equal(second, true);
  assert.equal(calls.length, 1);
});

test('canvas membership checker dedupes in-flight requests', async () => {
  const calls = [];
  const checker = createCanvasCourseMembershipChecker({
    makeCanvasApiRequest: async (endpoint) => {
      calls.push(endpoint);
      await new Promise((resolve) => setTimeout(resolve, 10));
      return [{ id: 1, email: 'bud@cow.com', login_id: 'bud@cow.com' }];
    },
  });

  const [first, second] = await Promise.all([checker.isLearnerInCanvasCourse('12345', 'bud@cow.com'), checker.isLearnerInCanvasCourse('12345', 'bud@cow.com')]);

  assert.equal(first, true);
  assert.equal(second, true);
  assert.equal(calls.length, 1);
});
