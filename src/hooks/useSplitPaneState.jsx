import React from 'react';

export default function useSplitPaneState(initialPercent = 55) {
  const [panePercent, setPanePercent] = React.useState(initialPercent);
  const splitContainerRef = React.useRef(null);

  const clamp = React.useCallback((value, min, max) => {
    return Math.max(min, Math.min(max, value));
  }, []);

  const updateSplitFromClientX = React.useCallback(
    (clientX) => {
      const rect = splitContainerRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0) return;
      const nextPercent = ((clientX - rect.left) / rect.width) * 100;
      setPanePercent(clamp(nextPercent, 0, 99));
    },
    [clamp],
  );

  const onPaneMoved = React.useCallback(
    (clientX) => {
      updateSplitFromClientX(clientX);
    },
    [updateSplitFromClientX],
  );

  const onPaneResized = React.useCallback(
    (clientX) => {
      updateSplitFromClientX(clientX);
    },
    [updateSplitFromClientX],
  );

  return {
    panePercent,
    splitContainerRef,
    onPaneMoved,
    onPaneResized,
  };
}
