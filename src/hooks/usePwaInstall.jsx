import React from 'react';

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isIosSafari() {
  if (typeof window === 'undefined') return false;

  const userAgent = window.navigator.userAgent || '';
  const vendor = window.navigator.vendor || '';
  const isIos = /iphone|ipad|ipod/i.test(userAgent);
  const isWebkitSafari = /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS/i.test(userAgent) && /Apple/i.test(vendor);

  return isIos && isWebkitSafari;
}

export default function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = React.useState(null);
  const [standalone, setStandalone] = React.useState(() => isStandalone());
  const [iosSafari, setIosSafari] = React.useState(() => isIosSafari());

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const mediaQuery = window.matchMedia('(display-mode: standalone)');

    function handleStandaloneChange(event) {
      setStandalone(Boolean(event.matches) || window.navigator.standalone === true);
    }

    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      setDeferredPrompt(event);
    }

    function handleAppInstalled() {
      setDeferredPrompt(null);
      setStandalone(true);
    }

    setStandalone(isStandalone());
    setIosSafari(isIosSafari());

    mediaQuery.addEventListener('change', handleStandaloneChange);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      mediaQuery.removeEventListener('change', handleStandaloneChange);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  async function promptInstall() {
    if (!deferredPrompt) return false;

    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return true;
  }

  return {
    canPromptInstall: Boolean(deferredPrompt) && !standalone,
    showIosInstructions: iosSafari && !standalone,
    isStandalone: standalone,
    promptInstall,
  };
}
