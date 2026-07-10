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
 * Each flush calls onProgress(null, null, progressType, seconds). The progress layer is
 * responsible for how often it writes an actual history row vs. only updating the cached
 * summary (see courseOps row throttling).
 *
 * onProgress is read through a ref so an unstable callback identity does not reset the
 * accumulator on every render.
 *
 * @param {Object} options
 * @param {string} options.progressType - e.g. 'instructionView', 'draView'
 * @param {Function} options.onProgress - (interactionId, unused, type, durationSeconds) => Promise|void
 * @param {boolean} [options.enabled=true]
 * @param {number} [options.minDuration=10] - minimum accrued seconds before a flush records
 * @param {Array} [options.dependencies=[]] - restart tracking when these change
 * @returns {{ flush: Function, getCurrentDuration: Function }}
 */
const IDLE_LIMIT_MS = 90 * 1000;
const PERIODIC_FLUSH_MS = 60 * 1000;
const ACTIVITY_EVENTS = ['keydown', 'pointerdown', 'pointermove', 'wheel', 'scroll', 'touchstart'];

export default function useProgressTracking({ progressType, onProgress, enabled = true, minDuration = 10, dependencies = [] }) {
  const accumulatedMsRef = useRef(0); // active time not yet flushed
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

  async function flush() {
    settleSegment();
    const seconds = Math.round(accumulatedMsRef.current / 1000);
    // Restart a segment immediately so tracking continues after the flush.
    maybeStartSegment();

    if (seconds < minDuration) return false;
    const report = onProgressRef.current;
    if (!report) return false;

    accumulatedMsRef.current = 0; // reset only what we are about to report
    try {
      await report(null, null, progressType, seconds);
      return true;
    } catch {
      // Put the time back so it can be retried on the next flush.
      accumulatedMsRef.current += seconds * 1000;
      return false;
    }
  }

  useEffect(() => {
    if (!enabled) return undefined;

    accumulatedMsRef.current = 0;
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
        // Fold the current segment and flush the accrued time while leaving.
        void flush();
        settleSegment();
      } else {
        lastActivityAtRef.current = Date.now();
        maybeStartSegment();
      }
    };

    const onPageHide = () => {
      void flush();
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
      void flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressType, enabled, minDuration, ...dependencies]);

  return { flush, getCurrentDuration };
}
