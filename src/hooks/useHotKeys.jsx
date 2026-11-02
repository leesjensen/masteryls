import React from 'react';

/**
 * useHotkeys
 * handlers: { [key: string]: (e: KeyboardEvent) => void }
 * options:
 *  - enabled: boolean (default true)
 *  - preventDefault: boolean (default true) — prevents default for handled keys
 */
export default function useHotkeys(handlers, { enabled = true, preventDefault = true } = {}) {
  const handlersRef = React.useRef(handlers);
  React.useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  React.useEffect(() => {
    if (!enabled) return;

    const el = window;

    const onKeyDown = (e) => {
      const key = e.key && e.key.length === 1 ? e.key.toLowerCase() : e.key;

      // Create a key string that includes modifiers
      let keyString = '';
      if (e.ctrlKey) keyString += 'ctrl+';
      if (e.altKey) keyString += 'alt+';
      if (e.shiftKey) keyString += 'shift+';
      if (e.metaKey) keyString += 'meta+';
      keyString += key;

      // Try the full key combination first, then fall back to just the key
      const fn = handlersRef.current?.[keyString] || handlersRef.current?.[key];
      if (fn) {
        if (preventDefault) e.preventDefault();
        fn(e);
      }
    };

    el.addEventListener('keydown', onKeyDown);
    return () => el.removeEventListener('keydown', onKeyDown);
  }, [enabled, preventDefault]);
}
