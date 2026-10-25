import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { RefreshCw } from 'lucide-react';
import { updateAppBar } from '../../hooks/useAppBarState';
import { markdownSanitizeSchema } from '../../components/markdownSanitize';
import { applyPwaUpdate } from '../../utils/pwaUpdate.js';
import '../../components/markdown.css';

const readmeUrl = 'https://github.com/leesjensen/masteryls/blob/main/README.md';
const rawRepositoryUrl = 'https://raw.githubusercontent.com/leesjensen/masteryls/main/';
const githubRepositoryUrl = 'https://github.com/leesjensen/masteryls/blob/main/';
const initialReadmePath = 'README.md';

function rawRepositoryPath(path) {
  return new URL(path, rawRepositoryUrl).toString();
}

function githubRepositoryPath(path) {
  return new URL(path, githubRepositoryUrl).toString();
}

function resolveReadmeUrl(value, currentPath) {
  if (!value || value.startsWith('#')) return value;

  try {
    return new URL(value, rawRepositoryPath(currentPath)).toString();
  } catch {
    return value;
  }
}

function resolveRelativeRepositoryPath(value, currentPath) {
  if (!value || value.startsWith('#') || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value)) return null;

  try {
    const target = new URL(value, rawRepositoryPath(currentPath));
    const repositoryPath = new URL(rawRepositoryUrl).pathname;
    if (target.origin !== new URL(rawRepositoryUrl).origin || !target.pathname.startsWith(repositoryPath)) return null;

    return {
      path: decodeURIComponent(target.pathname.slice(repositoryPath.length)),
      hash: target.hash,
    };
  } catch {
    return null;
  }
}

function isMarkdownPath(path) {
  return /\.md(?:own)?$/i.test(path);
}

function waitForWaitingWorker(registration, worker, timeoutMs = 15000) {
  if (registration.waiting) return Promise.resolve(registration.waiting);
  if (!worker) return Promise.resolve(null);

  return new Promise((resolve) => {
    let timeoutId;
    const finish = (waitingWorker) => {
      clearTimeout(timeoutId);
      worker.removeEventListener('statechange', onStateChange);
      resolve(waitingWorker || null);
    };
    const onStateChange = () => {
      if (registration.waiting) finish(registration.waiting);
      else if (worker.state === 'activated' || worker.state === 'redundant') finish(null);
    };
    worker.addEventListener('statechange', onStateChange);
    timeoutId = setTimeout(() => finish(registration.waiting), timeoutMs);
    onStateChange();
  });
}

function AboutView() {
  const [version, setVersion] = useState('Unavailable');
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState('');
  const [readme, setReadme] = useState(null);
  const [readmeError, setReadmeError] = useState(false);
  const [readmePath, setReadmePath] = useState(initialReadmePath);

  useEffect(() => {
    updateAppBar({ title: 'About', tools: null });

    let isMounted = true;

    fetch('/version.json', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`Unable to load version (${response.status})`);
        return response.json();
      })
      .then((data) => {
        if (isMounted && data.version) setVersion(data.version);
      })
      .catch(() => {
        // Keep the footer useful if version.json is unavailable in a local build.
      });

    return () => {
      isMounted = false;
    };
  }, []);

  async function checkForUpdates() {
    if (!navigator.onLine) {
      setUpdateStatus('Connect to the internet to check for updates.');
      return;
    }

    setCheckingUpdate(true);
    setUpdateStatus('Checking for updates…');
    try {
      const response = await fetch(`/version.json?check=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Unable to check the latest version (${response.status})`);
      const latestVersion = (await response.json())?.version;
      const registration = await navigator.serviceWorker?.getRegistration('/');

      if (registration) {
        await registration.update();
        let waitingWorker = registration.waiting;
        if (!waitingWorker && registration.installing) {
          setUpdateStatus(`Version ${latestVersion || 'latest'} found. Preparing the update…`);
          waitingWorker = await waitForWaitingWorker(registration, registration.installing);
        }

        if (waitingWorker) {
          setUpdateStatus(`Version ${latestVersion || 'latest'} found. Updating now…`);
          if (await applyPwaUpdate()) return;
          setUpdateStatus('The update is ready. Reload this page to use it.');
          return;
        }
        if (registration.installing) {
          setUpdateStatus('The latest version is downloading. It will be ready to apply shortly.');
          return;
        }
      }

      if (latestVersion && version !== 'Unavailable' && latestVersion !== version) {
        setUpdateStatus(`Version ${latestVersion} is available. Reloading to update…`);
        window.location.reload();
        return;
      }
      setUpdateStatus(`You’re up to date${latestVersion ? ` (version ${latestVersion})` : ''}.`);
    } catch (error) {
      setUpdateStatus(error?.message || 'Unable to check for updates.');
    } finally {
      setCheckingUpdate(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    setReadme(null);
    setReadmeError(false);

    fetch(rawRepositoryPath(readmePath), { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Unable to load Markdown (${response.status})`);
        return response.text();
      })
      .then((content) => {
        setReadme(content);
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setReadmeError(true);
      });

    return () => {
      controller.abort();
    };
  }, [readmePath]);

  return (
    <main className="flex min-h-0 flex-1 flex-col bg-white">
      <div className="min-h-0 flex-1 overflow-auto p-2 sm:p-4">
        <div className="markdown-body mx-auto min-h-full max-w-5xl rounded border border-gray-200 p-4 sm:p-8">
          {readmePath !== initialReadmePath && (
            <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-gray-200 pb-4 text-sm">
              <button type="button" onClick={() => setReadmePath(initialReadmePath)} className="text-amber-700 hover:text-amber-600 hover:underline">
                ← Back to README
              </button>
              <span className="text-gray-500">{readmePath}</span>
            </div>
          )}
          {readme ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[[rehypeRaw], [rehypeSanitize, markdownSanitizeSchema]]}
              components={{
                a({ href, children, ...props }) {
                  const repositoryTarget = resolveRelativeRepositoryPath(href, readmePath);
                  if (repositoryTarget && isMarkdownPath(repositoryTarget.path)) {
                    return (
                      <a
                        href={`${githubRepositoryPath(repositoryTarget.path)}${repositoryTarget.hash}`}
                        onClick={(event) => {
                          event.preventDefault();
                          setReadmePath(repositoryTarget.path);
                        }}
                        {...props}
                      >
                        {children}
                      </a>
                    );
                  }

                  const isAnchor = href?.startsWith('#');
                  return (
                    <a href={resolveReadmeUrl(href, readmePath)} {...(!isAnchor && { target: '_blank', rel: 'noreferrer' })} {...props}>
                      {children}
                    </a>
                  );
                },
                img({ src, ...props }) {
                  return <img src={resolveReadmeUrl(src, readmePath)} {...props} />;
                },
              }}
            >
              {readme}
            </ReactMarkdown>
          ) : readmeError ? (
            <div className="py-8 text-center text-gray-600">
              <p>Unable to load the README here.</p>
              <a href={readmeUrl} target="_blank" rel="noreferrer" className="text-amber-700 hover:text-amber-600 hover:underline">
                Open README in GitHub
              </a>
            </div>
          ) : (
            <p className="py-8 text-center text-gray-600">Loading README…</p>
          )}
        </div>
      </div>
      <footer className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
        <span>Version {version}</span>
        <button type="button" onClick={checkForUpdates} disabled={checkingUpdate} className="inline-flex items-center gap-1 text-amber-700 hover:text-amber-600 hover:underline disabled:cursor-wait disabled:opacity-60">
          <RefreshCw size={14} className={checkingUpdate ? 'animate-spin' : ''} />
          {checkingUpdate ? 'Checking…' : 'Check for updates'}
        </button>
        {updateStatus && <span role="status" className="w-full text-center text-xs text-gray-500">{updateStatus}</span>}
        <a href={readmeUrl} target="_blank" rel="noreferrer" className="text-amber-700 hover:text-amber-600 hover:underline">
          Open README in GitHub
        </a>
      </footer>
    </main>
  );
}

export default AboutView;
