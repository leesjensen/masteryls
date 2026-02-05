import React from 'react';

export default function Splitter({ onResize, minPosition = 0, maxPosition = Infinity }) {
  const isResizing = React.useRef(false);

  function handleMouseDown() {
    isResizing.current = true;
    document.body.style.userSelect = 'none';
  }

  React.useEffect(() => {
    function handleMouseMove(e) {
      if (isResizing.current && onResize) {
        const position = e.clientX;
        const clampedPosition = Math.max(minPosition, Math.min(maxPosition, position));
        onResize(clampedPosition);
      }
    }

    function handleMouseUp() {
      isResizing.current = false;
      document.body.style.userSelect = '';
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [onResize, minPosition, maxPosition]);

  return <div className="w-[6px] cursor-col-resize bg-gray-200 z-10 hover:bg-amber-300 transition-colors touch-none" onMouseDown={handleMouseDown} />;
}
