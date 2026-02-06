import React from 'react';

export default function Splitter({ onMove, onResized, minPosition = 0, maxPosition = Infinity }) {
  const isResizing = React.useRef(false);

  function handleMouseDown() {
    isResizing.current = true;
    document.body.style.userSelect = 'none';
  }

  React.useEffect(() => {
    function handleMouseMove(e) {
      if (isResizing.current && onMove) {
        onMove(e.clientX);
      }
    }

    function handleMouseUp(e) {
      if (isResizing.current && onResized) {
        isResizing.current = false;
        document.body.style.userSelect = '';
        if (onResized) {
          onResized(e.clientX);
        }
      }
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [minPosition, maxPosition]);

  return <div className="w-[6px] cursor-col-resize bg-gray-200 z-10 hover:bg-amber-300 transition-colors touch-none" onMouseDown={handleMouseDown} />;
}
