import { useRef, useEffect } from 'react';

export function useSwipeNavigation(onSwipeLeft, onSwipeRight, { enabled = true } = {}) {
  const ref = useRef(null);
  const callbacksRef = useRef({ onSwipeLeft, onSwipeRight });
  callbacksRef.current = { onSwipeLeft, onSwipeRight };

  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return undefined;
    let touchStart = null;

    const handleTouchStart = (e) => {
      if (e.touches && e.touches.length === 1) {
        const target = e.target instanceof Element ? e.target : e.target?.parentElement;
        if (target?.closest('input, textarea, select, button, a, iframe, [contenteditable="true"], [role="button"], [data-no-topic-swipe]')) {
          touchStart = null;
          return;
        }

        // Leave horizontal scrolling to nested scrollable content such as wide tables.
        let ancestor = target;
        while (ancestor && ancestor !== el) {
          const style = window.getComputedStyle(ancestor);
          if (ancestor.scrollWidth > ancestor.clientWidth + 1 && ['auto', 'scroll'].includes(style.overflowX)) {
            touchStart = null;
            return;
          }
          ancestor = ancestor.parentElement;
        }

        touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else {
        touchStart = null;
      }
    };

    const handleTouchEnd = (e) => {
      if (!touchStart || !e.changedTouches?.length) return;
      const diffX = e.changedTouches[0].clientX - touchStart.x;
      const diffY = e.changedTouches[0].clientY - touchStart.y;
      const threshold = 60;
      touchStart = null;

      // Require a clearly horizontal gesture so ordinary vertical page scrolling
      // does not change topics.
      if (Math.abs(diffX) >= threshold && Math.abs(diffX) > Math.abs(diffY) * 1.35) {
        if (diffX > 0) callbacksRef.current.onSwipeRight?.();
        else callbacksRef.current.onSwipeLeft?.();
      }
    };

    const handleTouchCancel = () => {
      touchStart = null;
    };

    el.addEventListener('touchstart', handleTouchStart);
    el.addEventListener('touchend', handleTouchEnd);
    el.addEventListener('touchcancel', handleTouchCancel);
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [enabled]);

  return ref;
}
