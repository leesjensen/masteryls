import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { updateAppBar } from '../../hooks/useAppBarState';
import { markdownSanitizeSchema } from '../../components/markdownSanitize';
import 'github-markdown-css/github-markdown-light.css';
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

function AboutView() {
  const [version, setVersion] = useState('Unavailable');
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
        <a href={readmeUrl} target="_blank" rel="noreferrer" className="text-amber-700 hover:text-amber-600 hover:underline">
          Open README in GitHub
        </a>
      </footer>
    </main>
  );
}

export default AboutView;
