import { useRef, useEffect } from 'react';

export function useSwipeNavigation(onSwipeLeft, onSwipeRight) {
  const ref = useRef(null);
  const touchStartX = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handleTouchStart = (e) => {
      if (e.touches && e.touches.length === 1) {
        touchStartX.current = e.touches[0].clientX;
      }
    };
    const handleTouchEnd = (e) => {
      if (touchStartX.current === null) return;
      const touchEndX = e.changedTouches[0].clientX;
      const diffX = touchEndX - touchStartX.current;
      const threshold = 50;
      if (diffX > threshold) {
        onSwipeRight && onSwipeRight();
      } else if (diffX < -threshold) {
        onSwipeLeft && onSwipeLeft();
      }
      touchStartX.current = null;
    };
    el.addEventListener('touchstart', handleTouchStart);
    el.addEventListener('touchend', handleTouchEnd);
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onSwipeLeft, onSwipeRight]);
  return ref;
}
