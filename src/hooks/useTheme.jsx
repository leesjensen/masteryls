import { useEffect, useState } from 'react';

// Also read by the inline script in index.html, so keep the two in sync.
const THEME_STORAGE_KEY = 'theme';

function readStoredDark() {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark';
  } catch {
    return false;
  }
}

function applyTheme(isDark) {
  document.documentElement.classList.toggle('dark', isDark);
}

export function useTheme() {
  const [isDark, setIsDark] = useState(readStoredDark);

  useEffect(() => {
    applyTheme(isDark);
  }, [isDark]);

  // Keeps other open MasteryLS tabs in step when the setting changes in one of them.
  useEffect(() => {
    function handleStorage(event) {
      if (event.key === THEME_STORAGE_KEY) setIsDark(event.newValue === 'dark');
    }

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  function setDark(nextIsDark) {
    setIsDark(nextIsDark);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextIsDark ? 'dark' : 'light');
    } catch {
      // Storage can be unavailable (e.g. blocked site data); the choice just won't persist.
    }
  }

  return { isDark, setDark };
}
