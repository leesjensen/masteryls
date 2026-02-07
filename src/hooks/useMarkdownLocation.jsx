import { useEffect, useRef } from 'react';

/**
 * Hook to track and restore scroll position for markdown content during the current session
 * @param {string} topicId - Unique identifier for the topic/content
 * @param {React.RefObject} containerRef - Reference to the scrollable container
 */
export default function useMarkdownLocation(topicId, containerRef) {
  // Store scroll positions for all topics in a single ref (persists across renders)
  const scrollPositions = useRef({});
  const isRestoringRef = useRef(false);

  // Track scroll position as user scrolls
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !topicId) return;

    const handleScroll = () => {
      if (isRestoringRef.current) return;

      console.log('scrolling, saving position for topic', topicId, {
        x: container.scrollLeft,
        y: container.scrollTop,
      });
      scrollPositions.current[topicId] = {
        x: container.scrollLeft,
        y: container.scrollTop,
      };
    };

    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [containerRef, topicId]);

  // Function to restore scroll position when window is ready
  const restoreScrollPosition = (currentTopicId) => {
    if (!containerRef.current || !currentTopicId) return false;

    const savedPosition = scrollPositions.current[currentTopicId];

    if (savedPosition) {
      isRestoringRef.current = true;

      requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.scrollTo({
            top: savedPosition.y,
            left: savedPosition.x,
            behavior: 'auto',
          });

          setTimeout(() => {
            isRestoringRef.current = false;
          }, 100);
        }
      });

      return true; // Position was restored
    }

    return false; // No saved position
  };

  return restoreScrollPosition;
}
