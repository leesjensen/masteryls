import React from 'react';

const DEFAULT_WEB_PAGE_HEIGHT = '70vh';
const MIN_WEB_PAGE_HEIGHT = '240px';
const MIN_WEB_PAGE_HEIGHT_PX = 240;

function resolveWebPageUrl(file, topicPath) {
  if (!file || !topicPath) return null;

  try {
    const url = new URL(file, topicPath);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function normalizeHeight(height) {
  if (typeof height === 'number' && Number.isFinite(height) && height > 0) {
    return `${height}px`;
  }

  if (typeof height === 'string') {
    const trimmed = height.trim();
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      return `${trimmed}px`;
    }
    if (/^\d+(\.\d+)?(px|rem|em|vh|vw|%)$/i.test(trimmed)) {
      return trimmed;
    }
  }

  return DEFAULT_WEB_PAGE_HEIGHT;
}

function escapeAttribute(value) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function addBaseElement(html, src) {
  const baseTag = `<base href="${escapeAttribute(src)}">`;

  if (/<head(\s[^>]*)?>/i.test(html)) {
    return html.replace(/<head(\s[^>]*)?>/i, `$&${baseTag}`);
  }

  if (/<html(\s[^>]*)?>/i.test(html)) {
    return html.replace(/<html(\s[^>]*)?>/i, `$&<head>${baseTag}</head>`);
  }

  return `<!doctype html><html><head>${baseTag}</head><body>${html}</body></html>`;
}

export default function WebPageInteraction({ title, file, height, topicPath }) {
  const src = React.useMemo(() => resolveWebPageUrl(file, topicPath), [file, topicPath]);
  const frameHeight = React.useMemo(() => normalizeHeight(height), [height]);
  const containerRef = React.useRef(null);
  const resizeCleanupRef = React.useRef(null);
  const [currentHeight, setCurrentHeight] = React.useState(frameHeight);
  const [srcDoc, setSrcDoc] = React.useState('');
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    setCurrentHeight(frameHeight);
  }, [frameHeight]);

  React.useEffect(() => {
    return () => resizeCleanupRef.current?.();
  }, []);

  React.useEffect(() => {
    if (!src) return;

    const controller = new AbortController();
    setSrcDoc('');
    setError('');

    fetch(src, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Unable to load ${src}`);
        }
        return response.text();
      })
      .then((html) => {
        setSrcDoc(addBaseElement(html, src));
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setError('Unable to load web page file.');
        }
      });

    return () => controller.abort();
  }, [src]);

  function resizeBy(delta) {
    const current = containerRef.current?.getBoundingClientRect().height || MIN_WEB_PAGE_HEIGHT_PX;
    const nextHeight = Math.max(MIN_WEB_PAGE_HEIGHT_PX, Math.round(current + delta));
    setCurrentHeight(`${nextHeight}px`);
  }

  function startResize(event) {
    if (!containerRef.current) return;

    event.preventDefault();
    resizeCleanupRef.current?.();

    const startY = event.clientY;
    const startHeight = containerRef.current.getBoundingClientRect().height;

    const handlePointerMove = (moveEvent) => {
      const nextHeight = Math.max(MIN_WEB_PAGE_HEIGHT_PX, Math.round(startHeight + moveEvent.clientY - startY));
      setCurrentHeight(`${nextHeight}px`);
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', cleanup);
      resizeCleanupRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', cleanup);
    resizeCleanupRef.current = cleanup;
  }

  function handleResizeKeyDown(event) {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      resizeBy(-24);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      resizeBy(24);
    }
  }

  if (!file) {
    return <div className="text-sm text-red-700">Missing web page file.</div>;
  }

  if (!src || error) {
    return <div className="text-sm text-red-700">Unable to load web page file.</div>;
  }

  return (
    <div data-plugin-masteryls-body={file}>
      <div ref={containerRef} className="w-full bg-white border border-neutral-300" data-plugin-masteryls-web-page style={{ height: currentHeight, minHeight: MIN_WEB_PAGE_HEIGHT, resize: 'vertical', overflow: 'hidden' }}>
        {srcDoc ? <iframe className="block w-full bg-white border-0" style={{ height: 'calc(100% - 10px)' }} srcDoc={srcDoc} data-src={src} data-plugin-masteryls-web-page-frame title={title || file} loading="lazy" sandbox="allow-scripts allow-forms allow-presentation" referrerPolicy="strict-origin-when-cross-origin" /> : null}
        <div className="w-full cursor-row-resize bg-neutral-100 border-t border-neutral-300 hover:bg-neutral-200 focus:outline-none focus:ring-2 focus:ring-blue-400" data-plugin-masteryls-web-page-resize-handle role="separator" aria-orientation="horizontal" aria-label="Resize web page" tabIndex={0} style={{ height: '10px' }} onPointerDown={startResize} onKeyDown={handleResizeKeyDown} />
      </div>
    </div>
  );
}
