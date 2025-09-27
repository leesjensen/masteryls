import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkEmoji from 'remark-emoji';
import remarkGithubBlockquoteAlert from 'remark-github-blockquote-alert';
import rehypeRaw from 'rehype-raw';
import { rehypeMermaid, MermaidBlock } from 'react-markdown-mermaid';
import 'github-markdown-css/github-markdown-light.css';
import './markdown.css';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { ghcolors } from 'react-syntax-highlighter/dist/esm/styles/prism';
import DiscussionPanel from '../../components/DiscussionPanel';

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

export default function MarkdownInstruction({ courseOps, topic, course, languagePlugins = [], user }) {
  const [markdown, setMarkdown] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [discussionOpen, setDiscussionOpen] = useState(false);
  const containerRef = React.useRef(null);

  useEffect(() => {
    if (topic.path) {
      setIsLoading(true);
      setMarkdown('');
      courseOps.getTopicMarkdown(topic).then((md) => {
        md = processRelativeImagePaths(md, topic.path);
        setMarkdown(md);
        setIsLoading(false);
      });
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
    md = md.replace(/!\[([^\]]*)\]\((?!https?:\/\/|\/)([^)]+)\)/g, (match, altText, url) => {
      const basePath = baseUrl.substring(0, baseUrl.lastIndexOf('/'));
      const absUrl = `${basePath}/${url.replace(/^\.\//, '')}`;
      return `![${altText}](${absUrl})`;
    });

    return md;
  }

  const customComponents = {
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      const language = match?.[1];

      if (!inline && language === 'masteryls') {
        // masteryls quiz blocks
        const plugin = languagePlugins.find((p) => p.lang === 'masteryls');
        if (plugin?.processor) {
          const content = String(children).replace(/\n$/, '');
          const pluginJsx = plugin.processor(content);
          return (
            <div
              onClick={(e) => {
                const masteryElement = e.target.closest('[data-plugin-masteryls]');
                if (masteryElement && plugin.handler) {
                  plugin.handler(e, masteryElement);
                }
              }}
            >
              {pluginJsx}
            </div>
          );
        }
        return (
          <pre className={className} {...props}>
            <code>{children}</code>
          </pre>
        );
      }

      // Use SyntaxHighlighter for fenced code blocks with a language
      if (!inline && language) {
        const codeText = String(children).replace(/\n$/, '');
        return (
          <SyntaxHighlighter language={language} style={ghcolors} PreTag="div" {...props}>
            {codeText}
          </SyntaxHighlighter>
        );
      }

      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },

    // Custom link handler
    a({ href, children, ...props }) {
      return (
        <a
          href={href}
          {...props}
          onClick={(e) => {
            e.preventDefault();
            if (href?.startsWith('http')) {
              window.open(href, '_blank', 'noopener,noreferrer');
            } else {
              const match = href?.match(/^([^#]*)(#.*)?$/);
              const hrefPath = match?.[1];
              const hrefAnchor = match?.[2];

              if (!hrefPath && hrefAnchor) {
                scrollToAnchor(hrefAnchor, containerRef);
              } else if (hrefPath) {
                const resolvedUrl = new URL(hrefPath, topic.path).toString();
                const targetTopic = course.topicFromPath(resolvedUrl, false);
                if (targetTopic) {
                  courseOps.changeTopic({ ...targetTopic, anchor: hrefAnchor });
                }
              }
            }
          }}
        >
          {children}
        </a>
      );
    },

    // Handle other plugin elements
    div({ node, className, children, ...props }) {
      // Check if this div has plugin attributes
      const pluginMatch = className?.match(/data-plugin-(\w+)/);
      if (pluginMatch) {
        const pluginLang = pluginMatch[1];
        const plugin = languagePlugins.find((p) => p.lang === pluginLang);
        if (plugin?.handler) {
          return (
            <div
              className={className}
              {...props}
              onClick={(e) => {
                const pluginElement = e.target.closest(`[data-plugin-${pluginLang}]`);
                if (pluginElement) {
                  plugin.handler(e, pluginElement);
                }
              }}
            >
              {children}
            </div>
          );
        }
      }
      return (
        <div className={className} {...props}>
          {children}
        </div>
      );
    },
  };

  const components = { ...customComponents, MermaidBlock };

  return (
    <>
      <div className="relative">
        {/* Discussion Toggle Button */}
        <button onClick={() => setDiscussionOpen(!discussionOpen)} className={`fixed top-4 right-4 z-40 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-md shadow-lg transition-all duration-200 ${discussionOpen ? 'right-[25rem]' : 'right-4'}`} title="Discuss this topic">
          💬 Discuss
        </button>

        <div ref={containerRef} className={`markdown-body p-4 transition-all duration-300 ease-in-out ${isLoading ? 'opacity-0 bg-black' : 'opacity-100 bg-transparent'} ${discussionOpen ? 'pr-[25rem]' : ''}`}>
          {markdown ? (
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkEmoji, remarkGithubBlockquoteAlert]} rehypePlugins={[[rehypeRaw], [rehypeMermaid, { mermaidConfig: { theme: 'default' } }]]} components={components}>
              {markdown}
            </ReactMarkdown>
          ) : (
            <div className="flex items-center justify-center" />
          )}
        </div>
      </div>

      {/* Discussion Panel */}
      <DiscussionPanel isOpen={discussionOpen} onClose={() => setDiscussionOpen(false)} topicTitle={topic?.title || 'Current Topic'} topicContent={markdown} user={user} />
    </>
  );
}
