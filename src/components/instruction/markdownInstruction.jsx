import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import DiscussionPanel from '../discussion/DiscussionPanel.jsx';
import Markdown from '../../components/Markdown';
import { scrollToAnchor, scrollToTextFragment } from '../../utils/utils';
import Splitter from '../../components/Splitter.jsx';
import useMarkdownLocation from '../../hooks/useMarkdownLocation';

import '../markdown.css';

// See instruction.jsx for why this needs to be a stable module-level default rather than
// an inline `= {}` - an inline object literal default is a new reference on every call
// when the caller doesn't pass previewFileUrls, which would defeat the content-load
// effect's dependency array below (it includes previewFileUrls) and re-run on every render.
const EMPTY_PREVIEW_FILE_URLS = {};

export default function MarkdownInstruction({ courseOps, learningSession, user, languagePlugins = [], content = null, instructionState = 'learning', previewFileUrls = EMPTY_PREVIEW_FILE_URLS }) {
  const isObserveReadOnly = Boolean(learningSession?.observeMode);
  const [markdown, setMarkdown] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [noteMessages, setNoteMessages] = useState([]);
  const [aiMessages, setAIMessages] = useState([]);
  const [discussWidth, setDiscussWidth] = useState(375);
  const [discussionOpen, setDiscussionOpen] = useState(false);
  const [discussionContext, setDiscussionContext] = useState({ topicTitle: learningSession.topic?.title || '', topicContent: content, section: null, mode: isObserveReadOnly ? 'notes' : 'ai' });
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false));
  const containerRef = React.useRef(null);
  const location = useLocation();
  const restoreScrollPosition = useMarkdownLocation(learningSession.topic.id, containerRef);
  const canDiscuss = user && instructionState === 'learning' && learningSession?.topic?.type !== 'schedule';

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (event) => setIsMobile(event.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const discussionFullScreen = canDiscuss && discussionOpen && isMobile;

  useEffect(() => {
    if (content) {
      load(content, learningSession.topic.path);
      return;
    }

    if (learningSession.topic.path) {
      if (!isLoading) {
        setIsLoading(true);
        courseOps.getTopic(learningSession.topic).then((md) => {
          load(md, learningSession.topic.path);
        });
      }
    }
    // Depend on the topic id/path rather than the whole learningSession object: the
    // periodic progress heartbeat replaces learningSession with a new reference every
    // ~60s (to record lastActivityAt), which would otherwise re-trigger a content
    // reload and the loading-overlay fade on every heartbeat, looking like a refresh.
  }, [learningSession.topic?.id, learningSession.topic?.path, content, instructionState, previewFileUrls]);

  useEffect(() => {
    if (!learningSession?.enrollment?.id) return;

    // Load saved notes from DB
    (async () => {
      const notes = (
        await courseOps.getProgress({
          topicId: learningSession.topic.id,
          enrollmentId: learningSession.enrollment.id,
          types: ['note'],
          limit: 100,
        })
      ).data;
      const loadedMessages = notes
        .filter((p) => p.details)
        .map((p) => {
          const details = { ...p.details };
          details.id = p.id;
          details.timestamp = new Date(p.createdAt).getTime();
          return details;
        })
        .sort((a, b) => a.timestamp - b.timestamp);
      setNoteMessages(loadedMessages);
      setDiscussionContext((prev) => ({ ...prev, topicTitle: learningSession.topic.title, topicContent: content, section: null }));
    })();
  }, [learningSession.topic.id, learningSession.enrollment?.id]);

  // Handle scrolling to a previous position, anchor, or top when switching topics
  useEffect(() => {
    if (markdown) {
      if (learningSession.topic) {
        const anchor = location.hash ? decodeURIComponent(location.hash.substring(1)) : null;
        if (anchor) {
          if (anchor === '@note') {
            setDiscussionContext((prev) => ({ ...prev, section: null, mode: 'notes' }));
            setDiscussionOpen(true);
          } else {
            scrollToAnchor(anchor, containerRef);
          }
        } else if (location.state?.searchHeadline) {
          const scrolled = scrollToTextFragment(location.state.searchHeadline, containerRef, {
            preferredIndex: location.state?.searchHeadlineIndex || 0,
          });
          if (!scrolled && containerRef.current) {
            containerRef.current.scrollTo({ top: 0, left: 0, behavior: 'auto' });
          }
        } else {
          const wasRestored = restoreScrollPosition(learningSession.topic.id);
          if (!wasRestored && containerRef.current) {
            containerRef.current.scrollTo({ top: 0, left: 0, behavior: 'auto' });
          }
        }
      }
    }
  }, [markdown, location.hash, location.key, location.state?.searchHeadline, location.state?.searchHeadlineIndex, location.state?.searchNavigationKey]);

  function load(content, path) {
    const md = processRelativeImagePaths(content, path);
    setMarkdown(md);
    setIsLoading(false);
  }

  function processRelativeImagePaths(md, baseUrl) {
    const basePath = baseUrl.substring(0, baseUrl.lastIndexOf('/'));
    const isAbsoluteUrl = (value) => /^[a-z][a-z\d+\-.]*:/i.test(value);
    const getPreviewFileUrl = (resourcePath) => {
      if (instructionState !== 'preview' || !resourcePath || resourcePath.startsWith('/') || isAbsoluteUrl(resourcePath)) {
        return null;
      }

      const cleanPath = resourcePath.split('#')[0].split('?')[0].replace(/^\.\/+/, '');
      const fileName = cleanPath.split('/').pop();
      return previewFileUrls[cleanPath] || previewFileUrls[fileName] || null;
    };
    const resolveResourcePath = (resourcePath) => {
      const previewFileUrl = getPreviewFileUrl(resourcePath);
      if (previewFileUrl) {
        return previewFileUrl;
      }
      return resourcePath.startsWith('/') || isAbsoluteUrl(resourcePath) ? resourcePath : `${basePath}/${resourcePath}`;
    };

    md = md.replace(/!\[(.*?)\]\(([^\)\s]+)\)/g, (match, p1, p2) => {
      const prefixedPath = resolveResourcePath(p2);
      return `![${p1}](${prefixedPath})`;
    });
    md = md.replace(/ src="([^"]+)"/g, (match, p1) => {
      const fullPath = resolveResourcePath(p1);
      return ` src="${fullPath}"`;
    });

    return md;
  }

  function discussResized(xPosition) {
    setDiscussWidth(window.innerWidth - xPosition - 8);
  }

  function discussMoved(xPosition) {
    setDiscussWidth(window.innerWidth - xPosition - 8);
  }

  function onMakeHeadingActive(headingText) {
    if (canDiscuss) {
      setDiscussionOpen(true);
      setDiscussionContext((prev) => ({ ...prev, section: headingText, mode: 'notes' }));
    }
    return null;
  }

  function onOpenDiscussion() {
    if (isObserveReadOnly) {
      setDiscussionContext((prev) => ({ ...prev, mode: 'notes' }));
    }
    setDiscussionOpen(true);
  }

  useEffect(() => {
    if (canDiscuss) {
      courseOps.setDiscussionToggleHandler(() => setDiscussionOpen((prev) => !prev));
    } else {
      courseOps.setDiscussionToggleHandler(null);
      setDiscussionOpen(false);
    }
  }, [courseOps, canDiscuss]);

  let markdownComponent = null;
  if (markdown) {
    const headingAction = canDiscuss ? onMakeHeadingActive : null;
    markdownComponent = <Markdown learningSession={learningSession} content={markdown} languagePlugins={languagePlugins} noteMessages={noteMessages} onMakeHeadingActive={headingAction} />;
  }

  return (
    <div className="flex h-full w-full min-h-0 overflow-hidden">
      {!discussionFullScreen && (
        <div ref={containerRef} data-editor-preview-scroll-container="true" className="relative flex-1 min-h-0 overflow-scroll">
          {!discussionOpen && canDiscuss && (
            <div className="sticky top-4 z-20 flex justify-end pr-6 pointer-events-none">
              <button onClick={onOpenDiscussion} className="pointer-events-auto px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-md shadow-lg transition-all duration-200 flex items-center gap-2" title="Discuss this topic">
                <MessageCircle size={18} /> Discuss
              </button>
            </div>
          )}
          <div className={`markdown-body p-4 transition-all duration-300 ease-in-out ${isLoading ? 'opacity-0 bg-black' : 'opacity-100 bg-transparent'}`}>{markdownComponent}</div>
        </div>
      )}

      {canDiscuss && discussionOpen && (
        <>
          {!discussionFullScreen && <Splitter onMove={discussMoved} onResized={discussResized} minPosition={150} maxPosition={window.innerWidth - 150} />}
          <div style={discussionFullScreen ? { width: '100%' } : { width: discussWidth }}>
            <DiscussionPanel
              style={{ width: discussWidth }}
              courseOps={courseOps}
              learningSession={learningSession}
              isOpen={discussionOpen}
              onClose={() => {
                setDiscussionOpen(false);
              }}
              user={user}
              noteMessages={noteMessages}
              setNoteMessages={setNoteMessages}
              aiMessages={aiMessages}
              setAIMessages={setAIMessages}
              discussionContext={discussionContext}
              setDiscussionContext={setDiscussionContext}
              allowAi={!isObserveReadOnly}
              readOnlyNotes={isObserveReadOnly}
            />
          </div>
        </>
      )}
    </div>
  );
}
