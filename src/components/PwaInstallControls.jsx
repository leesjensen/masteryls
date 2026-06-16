import React from 'react';
import { Download, Share, PlusSquare, RefreshCw, WifiOff, X } from 'lucide-react';
import usePwaInstall from '../hooks/usePwaInstall.jsx';

export function PwaInstallButton() {
  const { canPromptInstall, showIosInstructions, promptInstall } = usePwaInstall();
  const [showIosModal, setShowIosModal] = React.useState(false);

  if (!canPromptInstall && !showIosInstructions) {
    return null;
  }

  async function handleInstallClick() {
    if (canPromptInstall) {
      await promptInstall();
      return;
    }

    setShowIosModal(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        className="inline-flex h-8 items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
        title="Install app"
        aria-label="Install app"
      >
        <Download size={14} />
        <span className="hidden sm:inline">Install</span>
      </button>
      {showIosModal && <IosInstallModal onClose={() => setShowIosModal(false)} />}
    </>
  );
}

function IosInstallModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-900/45 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Install MasteryLS</h2>
            <p className="mt-1 text-sm text-slate-600">Add MasteryLS to your iPhone home screen for a full-screen app experience.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label="Close install instructions">
            <X size={18} />
          </button>
        </div>

        <ol className="space-y-3 text-sm text-slate-700">
          <li className="flex items-start gap-3">
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">1</span>
            <span className="pt-0.5">
              Tap the <span className="inline-flex items-center gap-1 font-medium text-slate-900"><Share size={14} /> Share</span> button in Safari.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">2</span>
            <span className="pt-0.5">
              Scroll down and choose <span className="inline-flex items-center gap-1 font-medium text-slate-900"><PlusSquare size={14} /> Add to Home Screen</span>.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">3</span>
            <span className="pt-0.5">Tap <b>Add</b> in the upper-right corner.</span>
          </li>
        </ol>
      </div>
    </div>
  );
}

export function PwaStatusToasts() {
  const [offline, setOffline] = React.useState(() => (typeof navigator !== 'undefined' ? !navigator.onLine : false));
  const [offlineReady, setOfflineReady] = React.useState(false);
  const [updateAction, setUpdateAction] = React.useState(null);

  React.useEffect(() => {
    function handleOnline() {
      setOffline(false);
    }

    function handleOffline() {
      setOffline(true);
    }

    function handleOfflineReady() {
      setOfflineReady(true);
    }

    function handleUpdateAvailable(event) {
      setUpdateAction(() => event.detail?.updateSW || null);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('pwa-offline-ready', handleOfflineReady);
    window.addEventListener('pwa-update-available', handleUpdateAvailable);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('pwa-offline-ready', handleOfflineReady);
      window.removeEventListener('pwa-update-available', handleUpdateAvailable);
    };
  }, []);

  return (
    <>
      {offline && (
        <div className="fixed inset-x-0 top-[42px] z-[9996] flex justify-center px-3">
          <div className="mt-2 inline-flex max-w-xl items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-900 shadow-sm">
            <WifiOff size={14} />
            <span>You are offline. MasteryLS can open, but course content, submissions, and AI features still require a connection.</span>
          </div>
        </div>
      )}

      {(offlineReady || updateAction) && (
        <div className="fixed inset-x-0 bottom-4 z-[9996] flex justify-center px-3">
          <div className="flex max-w-xl items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-lg">
            {updateAction ? (
              <>
                <RefreshCw size={16} className="text-blue-600" />
                <span className="flex-1">A new version of MasteryLS is ready.</span>
                <button
                  type="button"
                  className="rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
                  onClick={() => updateAction(true)}
                >
                  Refresh
                </button>
              </>
            ) : (
              <>
                <Download size={16} className="text-emerald-600" />
                <span>MasteryLS is ready for faster relaunches and home-screen install.</span>
                <button type="button" className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50" onClick={() => setOfflineReady(false)}>
                  Dismiss
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
