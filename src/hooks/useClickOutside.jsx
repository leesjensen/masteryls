import { useEffect } from 'react';

/**
 * useClickOutside
 * Calls callback when a click occurs outside the referenced element.
 * @param {React.RefObject} ref - The ref to the element to detect outside clicks for.
 * @param {Function} callback - The function to call on outside click.
 */
export default function useClickOutside(ref, callback) {
  useEffect(() => {
    function handleClick(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        callback(event);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
    };
  }, [ref, callback]);
}
