import React from 'react';

export default function useEditorPreviewSync({ topicId, content, editorPanePercent }) {
  const previewPaneRef = React.useRef(null);
  const editorInstanceRef = React.useRef(null);
  const editorScrollListenerRef = React.useRef(null);
  const previewScrollElementRef = React.useRef(null);
  const previewScrollListenerRef = React.useRef(null);
  const syncingFromEditorRef = React.useRef(false);
  const syncingFromPreviewRef = React.useRef(false);
  const previewUserIntentAtRef = React.useRef(0);
  const [editorSyncVersion, setEditorSyncVersion] = React.useState(0);

  function markPreviewUserIntent() {
    previewUserIntentAtRef.current = Date.now();
  }

  function hasRecentPreviewUserIntent() {
    return Date.now() - previewUserIntentAtRef.current < 300;
  }

  function getScrollableElement(container) {
    if (!container) return null;

    let best = null;
    let bestRange = 0;

    const allCandidates = [container, ...Array.from(container.querySelectorAll('*'))];
    for (const node of allCandidates) {
      const range = (node.scrollHeight || 0) - (node.clientHeight || 0);
      if (range > bestRange) {
        best = node;
        bestRange = range;
      }
    }

    return best || container;
  }

  function getScrollRange(node) {
    if (!node) return 0;
    return Math.max(0, (node.scrollHeight || 0) - (node.clientHeight || 0));
  }

  function getPreviewScrollElement() {
    const previewContainer = previewPaneRef.current;
    if (!previewContainer) return null;
    const explicitTarget = previewContainer.querySelector('[data-editor-preview-scroll-container="true"]');
    const discoveredTarget = getScrollableElement(previewContainer);
    const explicitRange = getScrollRange(explicitTarget);
    const discoveredRange = getScrollRange(discoveredTarget);

    let target = explicitTarget || discoveredTarget || previewContainer;
    if (discoveredRange > explicitRange) {
      target = discoveredTarget;
    }

    return target;
  }

  function syncPreviewFromEditor(editor) {
    let previewScrollable = previewScrollElementRef.current || getPreviewScrollElement();
    if (!previewScrollable) return;
    previewScrollElementRef.current = previewScrollable;

    const editorMax = Math.max(0, editor.getScrollHeight() - editor.getLayoutInfo().height);
    let previewMax = Math.max(0, previewScrollable.scrollHeight - previewScrollable.clientHeight);
    if (previewMax <= 0) {
      previewScrollable = getPreviewScrollElement();
      if (!previewScrollable) return;
      previewScrollElementRef.current = previewScrollable;
      previewMax = Math.max(0, previewScrollable.scrollHeight - previewScrollable.clientHeight);
      if (previewMax <= 0) return;
    }

    const ratio = editorMax > 0 ? editor.getScrollTop() / editorMax : 0;
    syncingFromEditorRef.current = true;
    previewScrollable.scrollTop = ratio * previewMax;
    requestAnimationFrame(() => {
      syncingFromEditorRef.current = false;
    });
  }

  React.useEffect(() => {
    const editor = editorInstanceRef.current;
    if (!editor) return;

    editorScrollListenerRef.current?.dispose?.();
    editorScrollListenerRef.current = editor.onDidScrollChange(() => {
      if (syncingFromPreviewRef.current) return;
      syncPreviewFromEditor(editor);
    });

    return () => {
      editorScrollListenerRef.current?.dispose?.();
      editorScrollListenerRef.current = null;
    };
  }, [topicId, editorPanePercent, editorSyncVersion]);

  React.useEffect(() => {
    const previewRoot = previewPaneRef.current;
    if (!previewRoot) return;

    previewScrollElementRef.current = getPreviewScrollElement();
    previewScrollListenerRef.current?.();

    const onPreviewScroll = (event) => {
      if (syncingFromEditorRef.current) return;
      if (!hasRecentPreviewUserIntent()) return;

      const editor = editorInstanceRef.current;
      if (!editor) return;

      const target = event?.target;
      if (!target || typeof target.scrollTop !== 'number' || typeof target.scrollHeight !== 'number' || typeof target.clientHeight !== 'number') {
        return;
      }

      const previewMax = Math.max(0, target.scrollHeight - target.clientHeight);
      if (previewMax <= 0) return;
      previewScrollElementRef.current = target;

      const editorMax = Math.max(0, editor.getScrollHeight() - editor.getLayoutInfo().height);
      const ratio = target.scrollTop / previewMax;

      syncingFromPreviewRef.current = true;
      editor.setScrollTop(ratio * editorMax);
      requestAnimationFrame(() => {
        syncingFromPreviewRef.current = false;
      });
    };

    const onPreviewUserIntent = () => {
      markPreviewUserIntent();
    };

    previewRoot.addEventListener('scroll', onPreviewScroll, { passive: true, capture: true });
    previewRoot.addEventListener('wheel', onPreviewUserIntent, { passive: true, capture: true });
    previewRoot.addEventListener('touchstart', onPreviewUserIntent, { passive: true, capture: true });
    previewRoot.addEventListener('touchmove', onPreviewUserIntent, { passive: true, capture: true });
    previewRoot.addEventListener('pointerdown', onPreviewUserIntent, { passive: true, capture: true });
    previewScrollListenerRef.current = () => {
      previewRoot.removeEventListener('scroll', onPreviewScroll, true);
      previewRoot.removeEventListener('wheel', onPreviewUserIntent, true);
      previewRoot.removeEventListener('touchstart', onPreviewUserIntent, true);
      previewRoot.removeEventListener('touchmove', onPreviewUserIntent, true);
      previewRoot.removeEventListener('pointerdown', onPreviewUserIntent, true);
      previewScrollListenerRef.current = null;
    };

    return () => {
      previewScrollListenerRef.current?.();
    };
  }, [topicId, content, editorPanePercent, editorSyncVersion]);

  React.useEffect(() => {
    const editor = editorInstanceRef.current;
    if (!editor) return;
    const rafId = requestAnimationFrame(() => syncPreviewFromEditor(editor));
    return () => cancelAnimationFrame(rafId);
  }, [content, topicId, editorPanePercent]);

  const handleEditorReady = React.useCallback((editor) => {
    editorInstanceRef.current = editor;
    if (editor) {
      setEditorSyncVersion((v) => v + 1);
      syncPreviewFromEditor(editor);
    }
  }, []);

  return {
    previewPaneRef,
    handleEditorReady,
  };
}
