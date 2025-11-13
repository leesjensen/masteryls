import React, { useEffect, useState } from 'react';
import DiscussionPanel from '../../components/DiscussionPanel';
import Markdown from '../../components/Markdown';

export default function MarkdownInstruction({ courseOps, topic, user, languagePlugins = [], content = null, instructionState = 'learning' }) {
  const [markdown, setMarkdown] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [discussionOpen, setDiscussionOpen] = useState(false);
  const containerRef = React.useRef(null);

  useEffect(() => {
    if (content) {
      const md = processRelativeImagePaths(content, topic.path);
      setMarkdown(md);
      setIsLoading(false);
      return;
    }

    if (topic.path) {
      console.log(topic);
      if (!isLoading) {
        setIsLoading(true);
        courseOps.getTopicMarkdown(topic).then((md) => {
          md = processRelativeImagePaths(md, topic.path);
          setMarkdown(md);
          setIsLoading(false);
        });
      }
    }
  }, [topic]);

  useEffect(() => {
    if (markdown) {
      // Reset scroll to top of the scrollable container
      if (topic.anchor) {
        scrollToAnchor(topic.anchor, containerRef);
      } else if (containerRef.current) {
        containerRef.current.scrollTo({ top: 0, behavior: 'auto' });
      }
    }
  }, [markdown]);

  function processRelativeImagePaths(md, baseUrl) {
    const basePath = baseUrl.substring(0, baseUrl.lastIndexOf('/'));
    md = md.replace(/\]\(([^\)\s]+)\)/g, (match, p1) => {
      const prefixedPath = p1.startsWith('/') || p1.startsWith('http') ? p1 : `${basePath}/${p1}`;
      return `](${prefixedPath})`;
    });
    md = md.replace(/ src="([^"]+)"/g, (match, p1) => {
      const fullPath = p1.startsWith('/') || p1.startsWith('http') ? p1 : `${basePath}/${p1}`;
      return ` src="${fullPath}"`;
    });

    return md;
  }

  function scrollToAnchor(anchor, containerRef) {
    if (!containerRef.current || !anchor) return;

    let anchorId = anchor.startsWith('#') ? anchor.substring(1) : anchor;
    let targetElement = containerRef.current.querySelector(`#${CSS.escape(anchorId)}`);

    if (!targetElement) {
      const headings = containerRef.current.querySelectorAll('h1, h2, h3, h4, h5, h6');
      if (headings) {
        anchorId = anchorId.replaceAll('-', ' ');
        targetElement = Array.from(headings).find((h) => h.textContent.trim().toLowerCase() === anchorId.toLowerCase());
      }
    }

    if (targetElement) {
      targetElement.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'smooth' });
    }
  }

  return (
    <>
      <div className="relative">
        {user && instructionState === 'learning' && (
          <button onClick={() => setDiscussionOpen(!discussionOpen)} className={`fixed top-24 z-40 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-md shadow-lg transition-all duration-200 right-6`} title="Discuss this topic">
            💬 Discuss
          </button>
        )}

        <div ref={containerRef} className={`markdown-body p-4 transition-all duration-300 ease-in-out ${isLoading ? 'opacity-0 bg-black' : 'opacity-100 bg-transparent'} ${discussionOpen ? 'pr-[25rem]' : ''}`}>
          {markdown ? <Markdown content={markdown} languagePlugins={languagePlugins} /> : <div className="flex items-center justify-center" />}
        </div>
      </div>

      <DiscussionPanel isOpen={discussionOpen} onClose={() => setDiscussionOpen(false)} topicTitle={topic?.title || 'Current Topic'} topicContent={markdown} user={user} />
    </>
  );
}
