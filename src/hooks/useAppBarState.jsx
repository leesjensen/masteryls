import React, { useSyncExternalStore } from 'react';

let state = { title: 'Mastery LS', tools: null };
const listeners = new Set();

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => state;

export const updateAppBar = (title, tools) => {
  if (title !== undefined) {
    document.title = `MLS ${title}`;
    state = { ...state, title };
  }
  if (tools !== undefined) {
    state = { ...state, tools };
  }
  listeners.forEach((listener) => listener());
};

export const useAppBarState = () => {
  const state = useSyncExternalStore(subscribe, getSnapshot);
  return { title: state.title, tools: state.tools };
};
