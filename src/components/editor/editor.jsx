import React from 'react';
import Instruction from '../instruction/instruction.jsx';
import MarkdownEditor from './markdownEditor';
import EditorFiles from './editorFiles';
import EmbeddedInstruction from '../instruction/embeddedInstruction.jsx';
import EditorCommits from '../../components/EditorCommits';
import useLatest from '../../hooks/useLatest';
import Splitter from '../Splitter.jsx';

export default function Editor({ courseOps, user, learningSession }) {
  const [content, setContent] = React.useState('');
  const [showCommits, setShowCommits] = React.useState(false);
  const [diffContent, setDiffContent] = React.useState(null);
  const [editorPanePercent, setEditorPanePercent] = React.useState(55);
  const [editorSyncVersion, setEditorSyncVersion] = React.useState(0);

  const [committing, setCommitting] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const dirtyRef = useLatest(dirty);
  const contentRef = useLatest(content);

  // Ref to access MarkdownEditor's insert functionality
  const markdownEditorRef = React.useRef(null);
  const splitContainerRef = React.useRef(null);
  const previewPaneRef = React.useRef(null);
  const editorInstanceRef = React.useRef(null);
  const editorScrollListenerRef = React.useRef(null);
  const previewScrollElementRef = React.useRef(null);
  const previewScrollListenerRef = React.useRef(null);
  const syncingFromEditorRef = React.useRef(false);
  const syncingFromPreviewRef = React.useRef(false);
  const syncDebugEnabledRef = React.useRef(false);

  const contentAvailable = !!(learningSession?.topic && learningSession.topic.path && (!learningSession.topic.state || learningSession.topic.state === 'published'));

  React.useEffect(() => {
    syncDebugEnabledRef.current =
      (typeof window !== 'undefined' && window.__MASTERYLS_EDITOR_SYNC_DEBUG__ === true) ||
      (typeof localStorage !== 'undefined' && localStorage.getItem('masteryls:editorSyncDebug') === '1');

    if (syncDebugEnabledRef.current) {
      console.info('[EditorSync] Debug mode enabled');
    }
  }, []);

  function debugLog(message, details = undefined) {
    if (!syncDebugEnabledRef.current) return;
    if (details !== undefined) {
      console.info(`[EditorSync] ${message}`, details);
    } else {
      console.info(`[EditorSync] ${message}`);
    }
  }

  React.useEffect(() => {
    if (contentAvailable) {
      if (learningSession.topic?.type === 'embedded' || learningSession.topic?.type === 'video') {
        setContent(learningSession.topic.path || '');
      } else {
        courseOps.getTopic(learningSession.topic).then((markdown) => {
          setContent(markdown);
        });
      }
      setDiffContent(null);
      setDirty(false);

      return async () => {
        if (dirtyRef.current) {
          if (window.confirm('You have unsaved changes. Do you want to commit them before leaving?')) {
            await commit();
          }
        }
      };
    }
  }, [learningSession]);

  function handleEditorChange(value) {
    if (committing) return;
    setContent(value || '');
    setDirty(true);
  }

  async function discard() {
    let content = '';
    if (learningSession.topic?.type === 'embedded' || learningSession.topic?.type === 'video') {
      content = learningSession.topic.path || '';
    } else {
      content = await courseOps.getTopic(learningSession.topic);
    }
    setDirty(false);
    setContent(content);
  }

  async function commit() {
    if (committing || !dirtyRef.current) return;

    setCommitting(true);
    try {
      await courseOps.updateTopic(learningSession.topic, contentRef.current);
      setDirty(false);
    } catch (error) {
      alert('Failed to commit changes. Please try again.');
    } finally {
      setCommitting(false);
    }
  }

  function toggleShowCommits() {
    setShowCommits((v) => !v);
    setDiffContent(null);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function updateSplitFromClientX(clientX) {
    const rect = splitContainerRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const nextPercent = ((clientX - rect.left) / rect.width) * 100;
    setEditorPanePercent(clamp(nextPercent, 0, 99));
  }

  function onEditorPaneMoved(clientX) {
    updateSplitFromClientX(clientX);
  }

  function onEditorPaneResized(clientX) {
    updateSplitFromClientX(clientX);
  }

  function getScrollableElement(container) {
    if (!container) return null;
    if (container.scrollHeight > container.clientHeight + 1) return container;

    const candidates = container.querySelectorAll('*');
    for (const node of candidates) {
      if (node.scrollHeight > node.clientHeight + 1) {
        return node;
      }
    }
    return null;
  }

  function getPreviewScrollElement() {
    const previewContainer = previewPaneRef.current;
    if (!previewContainer) {
      debugLog('Preview pane ref is null');
      return null;
    }
    const explicitTarget = previewContainer.querySelector('[data-editor-preview-scroll-container="true"]');
    const target = explicitTarget || getScrollableElement(previewContainer) || previewContainer;
    if (!target) {
      debugLog('Preview scroll element not found');
    }
    return target;
  }

  function syncPreviewFromEditor(editor) {
    const previewScrollable = previewScrollElementRef.current || getPreviewScrollElement();
    if (!previewScrollable) return;
    previewScrollElementRef.current = previewScrollable;

    const editorMax = Math.max(0, editor.getScrollHeight() - editor.getLayoutInfo().height);
    const previewMax = Math.max(0, previewScrollable.scrollHeight - previewScrollable.clientHeight);
    const ratio = editorMax > 0 ? editor.getScrollTop() / editorMax : 0;
    debugLog('Editor -> Preview', {
      editorTop: editor.getScrollTop(),
      editorMax,
      previewMax,
      ratio,
    });

    syncingFromEditorRef.current = true;
    previewScrollable.scrollTop = ratio * previewMax;
    requestAnimationFrame(() => {
      syncingFromEditorRef.current = false;
    });
  }

  React.useEffect(() => {
    const editor = editorInstanceRef.current;
    if (!editor) {
      debugLog('Monaco editor instance missing; cannot bind editor scroll');
      return;
    }

    editorScrollListenerRef.current?.dispose?.();
    debugLog('Binding Monaco scroll listener');
    editorScrollListenerRef.current = editor.onDidScrollChange(() => {
      if (syncingFromPreviewRef.current) return;
      syncPreviewFromEditor(editor);
    });

    return () => {
      editorScrollListenerRef.current?.dispose?.();
      editorScrollListenerRef.current = null;
    };
  }, [learningSession.topic?.id, editorPanePercent, editorSyncVersion]);

  React.useEffect(() => {
    const previewRoot = previewPaneRef.current;
    if (!previewRoot) {
      debugLog('Cannot bind preview scroll listener (missing root)');
      return;
    }

    previewScrollElementRef.current = getPreviewScrollElement();
    previewScrollListenerRef.current?.();
    debugLog('Binding preview scroll listener (capture on root)', {
      rootClientHeight: previewRoot.clientHeight,
      rootScrollHeight: previewRoot.scrollHeight,
    });

    const onPreviewScroll = (event) => {
      if (syncingFromEditorRef.current) return;

      const editor = editorInstanceRef.current;
      if (!editor) return;

      const target = event?.target;
      if (!target || typeof target.scrollTop !== 'number' || typeof target.scrollHeight !== 'number' || typeof target.clientHeight !== 'number') {
        return;
      }

      previewScrollElementRef.current = target;

      const previewMax = Math.max(0, target.scrollHeight - target.clientHeight);
      if (previewMax <= 0) return;

      const editorMax = Math.max(0, editor.getScrollHeight() - editor.getLayoutInfo().height);
      const ratio = target.scrollTop / previewMax;
      debugLog('Preview -> Editor', {
        previewTop: target.scrollTop,
        previewMax,
        editorMax,
        ratio,
      });

      syncingFromPreviewRef.current = true;
      editor.setScrollTop(ratio * editorMax);
      requestAnimationFrame(() => {
        syncingFromPreviewRef.current = false;
      });
    };

    previewRoot.addEventListener('scroll', onPreviewScroll, { passive: true, capture: true });
    previewScrollListenerRef.current = () => {
      previewRoot.removeEventListener('scroll', onPreviewScroll, true);
      previewScrollListenerRef.current = null;
    };

    return () => {
      previewScrollListenerRef.current?.();
    };
  }, [learningSession.topic?.id, content, editorPanePercent, editorSyncVersion]);

  React.useEffect(() => {
    const editor = editorInstanceRef.current;
    if (!editor) return;
    const rafId = requestAnimationFrame(() => syncPreviewFromEditor(editor));
    return () => cancelAnimationFrame(rafId);
  }, [content, learningSession.topic?.id, editorPanePercent]);

  const handleEditorReady = React.useCallback((editor) => {
    editorInstanceRef.current = editor;
    if (editor) {
      debugLog('Editor ready', {
        hasGetScrollTop: typeof editor.getScrollTop === 'function',
        hasSetScrollTop: typeof editor.setScrollTop === 'function',
      });
      setEditorSyncVersion((v) => v + 1);
      syncPreviewFromEditor(editor);
    } else {
      debugLog('Editor disposed');
    }
  }, []);

  if (!contentAvailable) {
    return <div className="flex p-4 w-full select-none disabled bg-gray-200 text-gray-700">This topic content must be generated before it can be viewed.</div>;
  }

  function getEditor() {
    let editor = null;
    if (learningSession.topic?.type !== 'embedded' && learningSession.topic?.type !== 'video') {
      editor = <MarkdownEditor ref={markdownEditorRef} course={learningSession.course} currentTopic={learningSession.topic} content={content} diffContent={diffContent} onChange={handleEditorChange} commit={commit} onEditorReady={handleEditorReady} />;
    }
    return editor;
  }

  const editorComponent = (type) => {
    switch (type) {
      case 'embedded':
      case 'video':
        return (
          <div className="flex-1 flex flex-col overflow-hidden relative">
            <div className="basis-[32px] pt-2 flex items-center justify-between">
              <h1 className="text-lg font-bold pl-2 text-gray-800 mr-2">
                Editor
                <sup className="inline-block w-[1ch] text-center">{dirty ? '*' : ''}</sup>
              </h1>

              <div className="flex flex-1 pb-1">
                <div className="flex-1 mx-2">
                  <input id="url" type="text" value={content} onChange={(e) => handleEditorChange(e.target.value)} className="border rounded px-2 py-1 text-sm w-full" />
                </div>
                <div className="flex items-center gap-2">
                  <button className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:hover:bg-gray-400 text-xs" onClick={discard} disabled={!dirty || committing}>
                    Discard
                  </button>
                  <button className="mx-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:hover:bg-gray-400 text-xs flex items-center gap-2" onClick={commit} disabled={!dirty || committing}>
                    Commit
                  </button>
                </div>
              </div>
            </div>
            <EmbeddedInstruction learningSession={{ ...learningSession, topic: { ...learningSession.topic, path: content } }} />
          </div>
        );
      default:
        return (
          <div className="flex-1 flex flex-col overflow-hidden relative">
            <div className="basis-[32px] pt-2 flex items-center justify-between">
              <h1 className={`text-lg font-bold pl-2 text-gray-800 mr-2`}>
                Editor <sup className="inline-block w-[1ch] text-center">{dirty ? '*' : ''}</sup>
              </h1>

              <div className="flex">
                <div className="flex-1"></div>
                <div className="flex items-center gap-2">
                  <button className="mx-1 px-3 py-1 w-28 whitespace-nowrap bg-gray-100 text-blue-700 border border-blue-300 rounded hover:bg-blue-50 text-xs gap-2" onClick={toggleShowCommits}>
                    {showCommits ? 'Hide' : 'Show'} Commits
                  </button>
                  <button className="mx-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:hover:bg-gray-400 text-xs" onClick={discard} disabled={!dirty || committing}>
                    Discard
                  </button>
                  <button className="mx-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:hover:bg-gray-400 text-xs flex items-center gap-2" onClick={commit} disabled={!dirty || committing}>
                    Commit
                  </button>
                </div>
              </div>
            </div>
            {showCommits && <EditorCommits currentTopic={learningSession.topic} course={learningSession.course} user={user} courseOps={courseOps} setContent={setContent} setDiffContent={setDiffContent} setDirty={setDirty} />}
            <div className="flex-8/10 flex overflow-hidden min-w-0" ref={splitContainerRef}>
              <div className="flex h-full overflow-hidden min-w-0 shrink-0" style={{ width: `${editorPanePercent}%` }}>
                {getEditor()}
              </div>
              <Splitter onMove={onEditorPaneMoved} onResized={onEditorPaneResized} minPosition={0} maxPosition={window.innerWidth} />
              <div ref={previewPaneRef} className="h-full flex-1 min-w-0 overflow-auto border-l border-gray-200 bg-white">
                <Instruction courseOps={courseOps} learningSession={learningSession} user={user} content={content} instructionState="preview" />
              </div>
            </div>
            <div className="flex-2/10 flex overflow-hidden">
              <EditorFiles courseOps={courseOps} course={learningSession.course} currentTopic={learningSession.topic} onInsertFiles={(files) => markdownEditorRef.current.insertFiles(files)} />
            </div>
            {committing && (
              <div className="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center z-50 rounded">
                <div className="flex items-center gap-3 text-gray-700">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-blue-600"></div>
                  <span className="text-sm font-medium">Committing changes...</span>
                </div>
              </div>
            )}
          </div>
        );
    }
  };

  return editorComponent(learningSession.topic?.type);
}
