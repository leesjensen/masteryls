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
  const resizeObserverRef = useRef(null);
  const pendingScrollRef = useRef(null);
  const restoringTopicIdRef = useRef(null);

  // Clean up any pending restoration when topic changes
  useEffect(() => {
    // Cancel any pending restoration from previous topic
    if (resizeObserverRef.current) {
      console.log('Topic changed, canceling previous restoration');
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
      pendingScrollRef.current = null;
      restoringTopicIdRef.current = null;
      isRestoringRef.current = false;
    }
  }, [topicId]);

  // Track scroll position as user scrolls
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !topicId) return;

    let scrollTimeout;

    const handleScroll = () => {
      if (isRestoringRef.current) return;

      // Clear existing timeout
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }

      // Set new timeout to save position after user stops scrolling
      scrollTimeout = setTimeout(() => {
        console.log('scrolling, saving position for topic', topicId, container.scrollTop);
        scrollPositions.current[topicId] = container.scrollTop;
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

  // Function to restore scroll position when window is ready
  const restoreScrollPosition = (currentTopicId) => {
    console.log('restoreScrollPosition called for topic', currentTopicId);

    if (!containerRef.current || !currentTopicId) return false;

    const savedPosition = scrollPositions.current[currentTopicId];

    if (savedPosition) {
      console.log('restoring scroll position for topic', currentTopicId, savedPosition);

      isRestoringRef.current = true;
      pendingScrollRef.current = savedPosition;
      restoringTopicIdRef.current = currentTopicId;

      // Apply scroll immediately
      const applyScroll = () => {
        // Only apply if we're still on the same topic
        if (restoringTopicIdRef.current !== currentTopicId || !containerRef.current || pendingScrollRef.current === null) {
          return;
        }

        console.log('applying scroll', savedPosition);
        containerRef.current.scrollTo({
          top: pendingScrollRef.current,
          behavior: 'auto',
        });
      };

      requestAnimationFrame(applyScroll);

      // Set up ResizeObserver to re-apply scroll as content loads
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }

      let resizeCount = 0;
      const maxResizes = 30; // Allow more resizes for slow-loading images
      let stabilizeTimeout;

      resizeObserverRef.current = new ResizeObserver(() => {
        // Only continue if we're still on the same topic
        if (restoringTopicIdRef.current !== currentTopicId) {
          console.log('Topic changed during restoration, aborting');
          if (resizeObserverRef.current) {
            resizeObserverRef.current.disconnect();
            resizeObserverRef.current = null;
          }
          pendingScrollRef.current = null;
          isRestoringRef.current = false;
          return;
        }

        resizeCount++;
        console.log(`Content resized (${resizeCount}), re-applying scroll position`);

        // Re-apply the scroll position
        applyScroll();

        // Clear previous timeout
        if (stabilizeTimeout) {
          clearTimeout(stabilizeTimeout);
        }

        // Stop observing after content stabilizes (no resize for 300ms) or max resizes reached
        stabilizeTimeout = setTimeout(() => {
          console.log('stabilized', containerRef.current.scrollTop);
          // Final check: only cleanup if still on same topic
          if (restoringTopicIdRef.current === currentTopicId && resizeObserverRef.current) {
            console.log('Content stabilized, stopping resize observation');
            resizeObserverRef.current.disconnect();
            resizeObserverRef.current = null;
            pendingScrollRef.current = null;
            restoringTopicIdRef.current = null;
            isRestoringRef.current = false;
          }
        }, 300);

        if (resizeCount >= maxResizes) {
          console.log('Max resizes reached, stopping observation');
          if (resizeObserverRef.current) {
            resizeObserverRef.current.disconnect();
            resizeObserverRef.current = null;
          }
          pendingScrollRef.current = null;
          restoringTopicIdRef.current = null;
          isRestoringRef.current = false;
        }
      });

      // Observe the container for size changes
      resizeObserverRef.current.observe(containerRef.current);

      return true; // Position was restored
    }

    return false; // No saved position
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
    };
  }, []);

  return restoreScrollPosition;
}
