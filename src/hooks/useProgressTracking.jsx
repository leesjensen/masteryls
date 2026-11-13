import { useEffect, useRef } from 'react';

/**
 * Tracks active viewing time for a topic and reports it to a progress sink.
 *
 * Time is accrued only while the learner is *active*: any input (keyboard, pointer,
 * scroll) keeps the session live; after IDLE_LIMIT_MS of no input, accrual pauses until
 * the next input, so a topic left open does not bank hours. Accrued time is flushed:
 *   - on a periodic timer (PERIODIC_FLUSH_MS)
 *   - when the page is hidden (visibilitychange) or unloaded (pagehide)
 *   - on unmount / dependency change
 *
 * Each flush folds the newly-accrued time into the cached summary. A history ROW is written only when
 * the current *view window* closes (a topic switch / navigation / tab hide / unmount, or the WINDOW_MS
 * cap), and that row's duration is the window's whole active time — not just the last tick. This keeps
 * the append-only log to ~one row per window while making SUM(duration) an accurate time-on-topic.
 * A row that is a WINDOW_MS continuation of an ongoing visit carries details.continuation = true so the
 * view *count* stays "one per visit" while time sums across all rows.
 *
 * Each flush calls onProgress(null, null, progressType, tickSeconds, details, { windowRowSeconds, commitWindowRow }):
 * tickSeconds is this flush's new active time (for the cache), windowRowSeconds is the window's running
 * total (the row duration), and commitWindowRow says whether to write the row now.
 *
 * onProgress is read through a ref so an unstable callback identity does not reset the
 * accumulator on every render.
 *
 * @param {Object} options
 * @param {string} options.progressType - e.g. 'instructionView', 'draView'
 * @param {Function} options.onProgress - (interactionId, unused, type, tickSeconds, details, options) => Promise|void
 * @param {boolean} [options.enabled=true]
 * @param {number} [options.minDuration=10] - minimum accrued seconds before a flush records
 * @param {Array} [options.dependencies=[]] - restart tracking when these change
 * @returns {{ flush: Function, getCurrentDuration: Function }}
 */
const IDLE_LIMIT_MS = 90 * 1000;
const PERIODIC_FLUSH_MS = 60 * 1000;
const WINDOW_MS = 5 * 60 * 1000; // cap one history row at 5 minutes of a visit (bounds crash-loss)
const ACTIVITY_EVENTS = ['keydown', 'pointerdown', 'pointermove', 'wheel', 'scroll', 'touchstart'];

export default function useProgressTracking({ progressType, onProgress, enabled = true, minDuration = 10, dependencies = [] }) {
  const accumulatedMsRef = useRef(0); // active time not yet flushed (this tick)
  const windowSecRef = useRef(0); // active seconds accrued in the current (not-yet-written) window
  const windowStartAtRef = useRef(Date.now()); // wall-clock start of the current window
  const firstWindowRef = useRef(true); // the first window of a visit is a view; later ones are continuations
  const segmentStartRef = useRef(null); // start of the current active+visible segment
  const lastActivityAtRef = useRef(Date.now());
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;

  // Fold the currently-running segment into the accumulator and stop the segment.
  function settleSegment() {
    if (segmentStartRef.current != null) {
      accumulatedMsRef.current += Date.now() - segmentStartRef.current;
      segmentStartRef.current = null;
    }
  }

  // Start a new active segment if conditions allow (enabled, visible, recently active).
  function maybeStartSegment() {
    if (!enabled) return;
    if (segmentStartRef.current != null) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    if (Date.now() - lastActivityAtRef.current >= IDLE_LIMIT_MS) return;
    segmentStartRef.current = Date.now();
  }

  function getCurrentDuration() {
    let ms = accumulatedMsRef.current;
    if (segmentStartRef.current != null) {
      ms += Date.now() - segmentStartRef.current;
    }
    return Math.round(ms / 1000);
  }

  async function flush({ closing = false } = {}) {
    settleSegment();
    const tickSeconds = Math.round(accumulatedMsRef.current / 1000);
    // Restart a segment immediately so tracking continues after the flush.
    maybeStartSegment();

    const report = onProgressRef.current;
    if (!report) return false;

    const windowShouldClose = closing || Date.now() - windowStartAtRef.current >= WINDOW_MS;
    // Report only when there's meaningful new time to fold into the cache, or a closing window worth
    // writing (>= minDuration). A trivial sub-minDuration visit stays a no-op, as before — this avoids
    // a needless progress write (and re-render) every time the learner briefly passes through a topic.
    if (tickSeconds < minDuration && !(windowShouldClose && windowSecRef.current + tickSeconds >= minDuration)) return false;

    accumulatedMsRef.current = 0; // consume this tick
    windowSecRef.current += tickSeconds;

    // Write a history row only when the window closes (its duration = the whole window's active time);
    // otherwise this flush just folds the tick into the cached summary (no row).
    const commitWindowRow = windowShouldClose && windowSecRef.current >= minDuration;
    const details = firstWindowRef.current ? {} : { continuation: true };

    try {
      await report(null, null, progressType, tickSeconds, details, { windowRowSeconds: windowSecRef.current, commitWindowRow });
      if (commitWindowRow) {
        windowSecRef.current = 0;
        windowStartAtRef.current = Date.now();
        firstWindowRef.current = false;
      }
      return true;
    } catch {
      // Put the time back so it can be retried on the next flush.
      accumulatedMsRef.current += tickSeconds * 1000;
      windowSecRef.current -= tickSeconds;
      return false;
    }
  }

  useEffect(() => {
    if (!enabled) return undefined;

    accumulatedMsRef.current = 0;
    windowSecRef.current = 0;
    windowStartAtRef.current = Date.now();
    firstWindowRef.current = true;
    lastActivityAtRef.current = Date.now();
    segmentStartRef.current = null;
    maybeStartSegment();

    const onActivity = () => {
      const wasIdle = Date.now() - lastActivityAtRef.current >= IDLE_LIMIT_MS;
      lastActivityAtRef.current = Date.now();
      if (wasIdle) {
        // Resuming from idle: start a fresh segment (idle gap is not counted).
        maybeStartSegment();
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        // Leaving/backgrounding: close the window and write its row while the page is still alive.
        void flush({ closing: true });
        settleSegment();
      } else {
        lastActivityAtRef.current = Date.now();
        maybeStartSegment();
      }
    };

    const onPageHide = () => {
      void flush({ closing: true });
    };

    // Pause accrual if the learner goes idle mid-segment.
    const idleTicker = setInterval(() => {
      if (segmentStartRef.current != null && Date.now() - lastActivityAtRef.current >= IDLE_LIMIT_MS) {
        settleSegment();
      }
    }, 15 * 1000);

    const periodic = setInterval(() => {
      void flush();
    }, PERIODIC_FLUSH_MS);

    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, onActivity, { passive: true, capture: true }));
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      clearInterval(idleTicker);
      clearInterval(periodic);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, onActivity, { capture: true }));
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      void flush({ closing: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressType, enabled, minDuration, ...dependencies]);

  return { flush, getCurrentDuration };
}
