import React, { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import DiscussionPanel from '../../components/DiscussionPanel';
import Markdown from '../../components/Markdown';
import { scrollToAnchor } from '../../utils/utils';
import Splitter from '../../components/Splitter.jsx';
import useMarkdownLocation from '../../hooks/useMarkdownLocation';
import '../markdown.css';

export default function MarkdownInstruction({ courseOps, learningSession, user, languagePlugins = [], content = null, instructionState = 'learning' }) {
  const [markdown, setMarkdown] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [noteMessages, setNoteMessages] = useState([]);
  const [discussWidth, setDiscussWidth] = useState(375);
  const [discussionOpen, setDiscussionOpen] = useState(false);
  const [activeSection, setActiveSection] = useState(null);
  const containerRef = React.useRef(null);
  const restoreScrollPosition = useMarkdownLocation(learningSession.topic.id, containerRef);

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
  }, [learningSession, content]);

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
          details.timestamp = new Date(p.createdAt);
          return details;
        })
        .sort((a, b) => a.timestamp - b.timestamp);
      setNoteMessages(loadedMessages);
      setActiveSection(null);
    })();
  }, [learningSession.topic.id, learningSession.enrollment?.id]);

  // If there's an anchor, scroll to it and save that position
  useEffect(() => {
    if (markdown) {
      if (learningSession.topic.anchor) {
        scrollToAnchor(learningSession.topic.anchor, containerRef);
      } else {
        // Restore saved scroll position for this topic (if any)
        const wasRestored = restoreScrollPosition(learningSession.topic.id);
        
        // If no saved position, scroll to top
        if (!wasRestored && containerRef.current) {
          containerRef.current.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        }
      }
    }
  }, [markdown, learningSession.topic.id, learningSession.topic.anchor, restoreScrollPosition]);

  function load(content, path) {
    const md = processRelativeImagePaths(content, path);
    setMarkdown(md);
    setIsLoading(false);
  }

  function processRelativeImagePaths(md, baseUrl) {
    const basePath = baseUrl.substring(0, baseUrl.lastIndexOf('/'));
    md = md.replace(/!\[(.+)\]\(([^\)\s]+)\)/g, (match, p1, p2) => {
      const prefixedPath = p2.startsWith('/') || p2.startsWith('http') ? p2 : `${basePath}/${p2}`;
      return `![${p1}](${prefixedPath})`;
    });
    md = md.replace(/ src="([^"]+)"/g, (match, p1) => {
      const fullPath = p1.startsWith('/') || p1.startsWith('http') ? p1 : `${basePath}/${p1}`;
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

  const onMakeHeadingActive =
    user && instructionState === 'learning'
      ? (headingText) => {
          setDiscussionOpen(true);
          setActiveSection(headingText);
        }
      : null;

  return (
    <div className="flex w-full overflow-auto  ">
      {!discussionOpen && user && instructionState === 'learning' && (
        <button onClick={() => setDiscussionOpen(!discussionOpen)} className="fixed top-24 z-40 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-md shadow-lg transition-all duration-200 right-4 flex items-center gap-2" title="Discuss this topic">
          <MessageCircle size={18} /> Discuss
        </button>
      )}

      <div ref={containerRef} className="flex-1 overflow-scroll">
        <div className={`markdown-body p-4 transition-all duration-300 ease-in-out ${isLoading ? 'opacity-0 bg-black' : 'opacity-100 bg-transparent'}`}>{markdown ? <Markdown learningSession={learningSession} content={markdown} languagePlugins={languagePlugins} noteMessages={noteMessages} onMakeHeadingActive={onMakeHeadingActive} /> : null}</div>
      </div>

      {user && discussionOpen && (
        <>
          <Splitter onMove={discussMoved} onResized={discussResized} minPosition={150} maxPosition={window.innerWidth - 150} />
          <div style={{ width: discussWidth }}>
            <DiscussionPanel
              style={{ width: discussWidth }}
              courseOps={courseOps}
              learningSession={learningSession}
              isOpen={discussionOpen}
              onClose={() => {
                setDiscussionOpen(false);
                setActiveSection(null);
              }}
              topicTitle={learningSession.topic?.title || 'Current Topic'}
              topicContent={markdown}
              user={user}
              noteMessages={noteMessages}
              setNoteMessages={setNoteMessages}
              section={activeSection}
            />
          </div>
        </>
      )}
    </div>
  );
}
