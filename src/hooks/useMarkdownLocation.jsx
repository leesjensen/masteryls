import { useEffect, useRef } from 'react';

// Global storage for scroll positions across all topics (persists across component unmounts)
const globalScrollPositions = {};

/**
 * Hook to track and restore scroll position for markdown content during the current session
 * @param {string} topicId - Unique identifier for the topic/content
 * @param {React.RefObject} containerRef - Reference to the scrollable container
 */
export default function useMarkdownLocation(topicId, containerRef) {
  const isRestoringRef = useRef(false);

  // Track scroll position as user scrolls
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !topicId) return;

    let scrollTimeout;

    const handleScroll = () => {
      if (isRestoringRef.current) return;

      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }

      // Set new timeout to save position after user stops scrolling
      scrollTimeout = setTimeout(() => {
        globalScrollPositions[topicId] = container.scrollTop;
      }, 1000);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, [containerRef, topicId]);

  // Function to restore scroll position when content is stable
  const restoreScrollPosition = (currentTopicId) => {
    if (!containerRef.current || !currentTopicId) return false;

    const savedPosition = globalScrollPositions[currentTopicId];

    if (savedPosition !== undefined) {
      isRestoringRef.current = true;
      let attempts = 0;
      const maxAttempts = 20;

      const tryScroll = () => {
        if (!containerRef.current) {
          isRestoringRef.current = false;
          return;
        }

        const container = containerRef.current;
        container.scrollTo({
          top: savedPosition,
          behavior: 'auto',
        });

        attempts++;
        const actualPosition = container.scrollTop;
        const isClose = Math.abs(actualPosition - savedPosition) < 5;

        // If we're close enough or hit max attempts, stop
        if (isClose || attempts >= maxAttempts) {
          isRestoringRef.current = false;
        } else {
          // Content might not be fully loaded, try again
          setTimeout(tryScroll, 100);
        }
      };

      requestAnimationFrame(tryScroll);

      return true;
    }

    return false;
  };

  return restoreScrollPosition;
}
