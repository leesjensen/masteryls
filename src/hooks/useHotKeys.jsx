import React from 'react';

/**
 * useHotkeys
 * handlers: { [key: string]: (e: KeyboardEvent) => void }
 * options:
 *  - target: Window | HTMLElement | React.RefObject<HTMLElement>
 *  - enabled: boolean (default true)
 *  - preventDefault: boolean (default true) — prevents default for handled keys
 *  - allowInInputs: string[] (default []) — keys allowed when focus is in INPUT/TEXTAREA/SELECT/contenteditable
 */
export default function useHotkeys(handlers, { target, enabled = true, preventDefault = true, allowInInputs = [] } = {}) {
  const handlersRef = React.useRef(handlers);
  React.useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  const allowInInputsRef = React.useRef(new Set((allowInInputs || []).map((key) => key.toLowerCase())));
  React.useEffect(() => {
    allowInInputsRef.current = new Set((allowInInputs || []).map((key) => key.toLowerCase()));
  }, [allowInInputs]);

  React.useEffect(() => {
    if (!enabled) return;

    const el = (target && typeof target === 'object' && 'current' in target ? target.current : target) || window;
    if (!el) return;

    const onKeyDown = (e) => {
      const t = e.target;
      const key = e.key && e.key.length === 1 ? e.key.toLowerCase() : e.key;

      // Create a key string that includes modifiers
      let keyString = '';
      if (e.ctrlKey) keyString += 'ctrl+';
      if (e.altKey) keyString += 'alt+';
      if (e.shiftKey) keyString += 'shift+';
      if (e.metaKey) keyString += 'meta+';
      keyString += key;

      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/i.test(t.tagName))) {
        if (!allowInInputsRef.current.has(keyString) && !allowInInputsRef.current.has(key)) return;
      }

      // Try the full key combination first, then fall back to just the key
      const fn = handlersRef.current?.[keyString] || handlersRef.current?.[key];
      if (fn) {
        if (preventDefault) e.preventDefault();
        fn(e);
      }
    };

    el.addEventListener('keydown', onKeyDown);
    return () => el.removeEventListener('keydown', onKeyDown);
  }, [target, enabled, preventDefault]);
}
