import { useEffect, useState } from 'react';

// index.html repeats this key, the media query and the light/dark/system rule in its pre-paint
// script, so change them in both places.
// Holds 'light' or 'dark' when the user has picked one; absent means follow the system.
const THEME_STORAGE_KEY = 'theme';
const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';

function toPreference(storedValue) {
  return storedValue === 'light' || storedValue === 'dark' ? storedValue : 'system';
}

function readStoredPreference() {
  try {
    return toPreference(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'system';
  }
}

function readSystemDark() {
  return window.matchMedia?.(SYSTEM_DARK_QUERY).matches ?? false;
}

function applyTheme(isDark) {
  document.documentElement.classList.toggle('dark', isDark);
}

export function useTheme() {
  const [preference, setPreferenceState] = useState(readStoredPreference);
  const [systemDark, setSystemDark] = useState(readSystemDark);
  const isDark = preference === 'system' ? systemDark : preference === 'dark';

  useEffect(() => {
    applyTheme(isDark);
  }, [isDark]);

  // Follows the OS/browser theme live, e.g. when the OS switches to dark at sunset.
  useEffect(() => {
    const query = window.matchMedia?.(SYSTEM_DARK_QUERY);
    if (!query) return;

    function handleChange(event) {
      setSystemDark(event.matches);
    }

    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  // Keeps other open MasteryLS tabs in step when the setting changes in one of them.
  useEffect(() => {
    function handleStorage(event) {
      if (event.key === THEME_STORAGE_KEY) setPreferenceState(toPreference(event.newValue));
    }

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  function setPreference(nextPreference) {
    setPreferenceState(nextPreference);
    try {
      if (nextPreference === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY);
      else window.localStorage.setItem(THEME_STORAGE_KEY, nextPreference);
    } catch {
      // Storage can be unavailable (e.g. blocked site data); the choice just won't persist.
    }
  }

  return { preference, setPreference };
}
