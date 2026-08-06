// Coalesces posting a learner's overall course mastery to the Canvas "Reading interactions"
// assignment. Mastery is recomputed on nearly every interaction, so posting on each change would
// be far too chatty. This scheduler:
//   - posts only when the (integer) mastery value actually changes,
//   - debounces bursts of changes into a single trailing post,
//   - dedupes in-flight posts so overlapping schedules coalesce,
//   - exposes flush() so callers can force the pending post on session end / topic change.
//
// `post` performs the network write (typically service.makeCanvasGradebookRequest) and resolves
// when done. It is given the full context so a single scheduler instance can serve whatever course
// / assignment / learner the session currently targets.
export function createMasteryCanvasSync({ post, debounceMs = 20000 }) {
  let timer = null;
  let pending = null; // latest ctx awaiting a post
  let lastPostedKey = null; // `${canvasAssignmentId}:${mastery}` of the last successful post
  let inFlight = null; // promise of the post currently being sent

  function keyFor(ctx) {
    return `${ctx.canvasAssignmentId}:${ctx.mastery}`;
  }

  async function send(ctx) {
    // Coalesce: if an identical post is already in flight, ride along with it.
    if (inFlight && inFlight.key === keyFor(ctx)) {
      return inFlight.promise;
    }
    const key = keyFor(ctx);
    const promise = (async () => {
      try {
        await post({
          courseId: String(ctx.canvasCourseId),
          catalogId: ctx.catalogId,
          topicType: 'mastery',
          percentCorrect: ctx.mastery,
          pointsPossible: 100,
          canvasAssignmentId: ctx.canvasAssignmentId,
          learnerEmail: ctx.learnerEmail,
          autoGrade: true,
        });
        lastPostedKey = key;
      } catch (ex) {
        // Leave lastPostedKey unchanged so a later change retries.
        // eslint-disable-next-line no-console
        console.error('Failed to sync mastery to Canvas:', ex);
      } finally {
        if (inFlight && inFlight.key === key) inFlight = null;
      }
    })();
    inFlight = { key, promise };
    return promise;
  }

  function clearTimer() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  // Register a mastery value to (eventually) post. No-op when nothing meaningful changed.
  function schedule(ctx) {
    if (!ctx || !ctx.canvasCourseId || !ctx.canvasAssignmentId || !Number.isFinite(Number(ctx.mastery))) {
      return;
    }
    const normalized = { ...ctx, mastery: Math.round(Number(ctx.mastery)) };
    if (keyFor(normalized) === lastPostedKey) {
      // Already reflected in Canvas; nothing to do.
      return;
    }
    pending = normalized;
    clearTimer();
    timer = setTimeout(() => {
      const ctxToSend = pending;
      pending = null;
      timer = null;
      if (ctxToSend) void send(ctxToSend);
    }, debounceMs);
  }

  // Force any pending post immediately (e.g. on topic change or when the page is hidden/unloaded).
  function flush() {
    clearTimer();
    const ctxToSend = pending;
    pending = null;
    if (ctxToSend) return send(ctxToSend);
    return Promise.resolve();
  }

  return { schedule, flush };
}
