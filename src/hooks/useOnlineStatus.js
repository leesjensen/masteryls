import { useSyncExternalStore } from 'react';

function subscribe(onChange) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

function getSnapshot() {
  return typeof navigator === 'undefined' || navigator.onLine;
}

export default function useOnlineStatus() {
  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}
