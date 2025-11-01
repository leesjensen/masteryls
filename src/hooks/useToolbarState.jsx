import { useSyncExternalStore } from 'react';

let storeTitle = 'unset';
const listeners = new Set();

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => storeTitle;

export const updateToolbarTitle = (title) => {
  document.title = `MLS ${title}`;
  storeTitle = title;
  listeners.forEach((listener) => listener());
};

export const useToolbarState = () => {
  const title = useSyncExternalStore(subscribe, getSnapshot);
  return { title };
};
