import React, { useEffect, useState } from 'react';
import DiscussionPanel from '../../components/DiscussionPanel';
import Markdown from '../../components/Markdown';
import { scrollToAnchor } from '../../utils/utils';

export default function MarkdownInstruction({ courseOps, learningSession, user, languagePlugins = [], content = null, instructionState = 'learning' }) {
  const [markdown, setMarkdown] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [discussionOpen, setDiscussionOpen] = useState(false);
  const containerRef = React.useRef(null);

  useEffect(() => {
    if (content) {
      load(content, learningSession.topic.path);
      return;
    }

    if (learningSession.topic.path) {
      if (!isLoading) {
        setIsLoading(true);
        courseOps.getTopicMarkdown(learningSession.course, learningSession.topic).then((md) => {
          load(md, learningSession.topic.path);
        });
      }
    }
  }, [learningSession, content]);

  useEffect(() => {
    if (markdown) {
      // Reset scroll to top of the scrollable container
      if (learningSession.topic.anchor) {
        scrollToAnchor(learningSession.topic.anchor, containerRef);
      } else if (containerRef.current) {
        containerRef.current.scrollTo({ top: 0, behavior: 'auto' });
      }
    }
  }, [markdown]);

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

  return (
    <div ref={containerRef} className="border-1 border-amber-200 rounded-sm m-2 flex w-full overflow-auto  ">
      <div className="relative">
        {user && instructionState === 'learning' && (
          <button onClick={() => setDiscussionOpen(!discussionOpen)} className={`fixed top-24 z-40 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-md shadow-lg transition-all duration-200 right-6`} title="Discuss this topic">
            💬 Discuss
          </button>
        )}

        <div className={`markdown-body p-4 transition-all duration-300 ease-in-out ${isLoading ? 'opacity-0 bg-black' : 'opacity-100 bg-transparent'} ${discussionOpen ? 'pr-[25rem]' : ''}`}>{markdown ? <Markdown learningSession={learningSession} content={markdown} languagePlugins={languagePlugins} /> : <div className="flex items-center justify-center" />}</div>
      </div>

      <DiscussionPanel isOpen={discussionOpen} onClose={() => setDiscussionOpen(false)} topicTitle={learningSession.topic?.title || 'Current Topic'} topicContent={markdown} user={user} />
    </div>
  );
}
