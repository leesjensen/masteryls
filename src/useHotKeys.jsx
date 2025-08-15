import React from 'react';

/**
 * useHotkeys
 * handlers: { [key: string]: (e: KeyboardEvent) => void }
 * options:
 *  - target: Window | HTMLElement | React.RefObject<HTMLElement>
 *  - enabled: boolean (default true)
 *  - preventDefault: boolean (default true) — prevents default for handled keys
 */
export default function useHotkeys(handlers, { target, enabled = true, preventDefault = true } = {}) {
  const handlersRef = React.useRef(handlers);
  React.useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  React.useEffect(() => {
    if (!enabled) return;

    const el = (target && typeof target === 'object' && 'current' in target ? target.current : target) || window;
    if (!el) return;

    const onKeyDown = (e) => {
      const t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/i.test(t.tagName))) return;

      const fn = handlersRef.current?.[e.key];
      if (fn) {
        if (preventDefault) e.preventDefault();
        fn(e);
      }
    };

    el.addEventListener('keydown', onKeyDown);
    return () => el.removeEventListener('keydown', onKeyDown);
  }, [target, enabled, preventDefault]);
}
