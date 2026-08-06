import test from 'node:test';
import assert from 'node:assert/strict';
import { createMasteryCanvasSync } from './masteryCanvasSync.js';

const baseCtx = { canvasCourseId: '12345', catalogId: 'cat-1', canvasAssignmentId: 999, learnerEmail: 'bud@cow.com' };

function makePoster() {
  const calls = [];
  let resolveNext;
  const post = async (params) => {
    calls.push(params);
    await new Promise((r) => {
      resolveNext = r;
      r();
    });
  };
  return { post, calls };
}

test('schedule debounces a burst into a single post with the latest mastery', async () => {
  const { post, calls } = makePoster();
  const sync = createMasteryCanvasSync({ post, debounceMs: 10 });

  sync.schedule({ ...baseCtx, mastery: 40 });
  sync.schedule({ ...baseCtx, mastery: 55 });
  sync.schedule({ ...baseCtx, mastery: 62 });

  await new Promise((r) => setTimeout(r, 30));

  assert.equal(calls.length, 1);
  assert.equal(calls[0].topicType, 'mastery');
  assert.equal(calls[0].percentCorrect, 62);
  assert.equal(calls[0].pointsPossible, 100);
  assert.equal(calls[0].autoGrade, true);
  assert.equal(calls[0].canvasAssignmentId, 999);
});

test('schedule does not post again when mastery is unchanged', async () => {
  const { post, calls } = makePoster();
  const sync = createMasteryCanvasSync({ post, debounceMs: 5 });

  sync.schedule({ ...baseCtx, mastery: 70 });
  await new Promise((r) => setTimeout(r, 15));
  assert.equal(calls.length, 1);

  // Same value should be skipped (no new post).
  sync.schedule({ ...baseCtx, mastery: 70 });
  await new Promise((r) => setTimeout(r, 15));
  assert.equal(calls.length, 1);

  // A different value posts again.
  sync.schedule({ ...baseCtx, mastery: 71 });
  await new Promise((r) => setTimeout(r, 15));
  assert.equal(calls.length, 2);
  assert.equal(calls[1].percentCorrect, 71);
});

test('flush posts the pending value immediately without waiting for the debounce', async () => {
  const { post, calls } = makePoster();
  const sync = createMasteryCanvasSync({ post, debounceMs: 10000 });

  sync.schedule({ ...baseCtx, mastery: 88 });
  assert.equal(calls.length, 0); // debounce not elapsed
  await sync.flush();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].percentCorrect, 88);
});

test('flush with nothing pending is a no-op', async () => {
  const { post, calls } = makePoster();
  const sync = createMasteryCanvasSync({ post, debounceMs: 10 });
  await sync.flush();
  assert.equal(calls.length, 0);
});

test('schedule ignores incomplete context (missing assignment or non-numeric mastery)', async () => {
  const { post, calls } = makePoster();
  const sync = createMasteryCanvasSync({ post, debounceMs: 5 });

  sync.schedule({ ...baseCtx, canvasAssignmentId: undefined, mastery: 50 });
  sync.schedule({ ...baseCtx, mastery: NaN });
  sync.schedule({ canvasCourseId: '', canvasAssignmentId: 1, mastery: 50 });
  await new Promise((r) => setTimeout(r, 15));
  assert.equal(calls.length, 0);
});

test('mastery is rounded before comparison and posting', async () => {
  const { post, calls } = makePoster();
  const sync = createMasteryCanvasSync({ post, debounceMs: 5 });

  sync.schedule({ ...baseCtx, mastery: 63.4 });
  await new Promise((r) => setTimeout(r, 15));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].percentCorrect, 63);

  // 63.2 rounds to the same 63 -> no new post.
  sync.schedule({ ...baseCtx, mastery: 63.2 });
  await new Promise((r) => setTimeout(r, 15));
  assert.equal(calls.length, 1);
});
