import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import mermaid from 'mermaid';
import 'github-markdown-css/github-markdown-light.css';

mermaid.initialize({ startOnLoad: false });

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

export default function MarkdownInstruction({ topic, changeTopic, course, languagePlugins = [] }) {
  const [markdown, setMarkdown] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = React.useRef(null);

  useEffect(() => {
    if (topic.path) {
      setIsLoading(true);
      setMarkdown('');
      // Get raw markdown instead of HTML
      course.topicMarkdown(topic).then((md) => {
        const processed = languagePlugins.reduce((acc, plugin) => {
          if (plugin.processor) {
            return plugin.processor(acc);
          }
          return acc;
        }, md);
        setMarkdown(processed);
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
      // Render mermaid diagrams after content is in the DOM
      setTimeout(() => {
        mermaid.run({ querySelector: '.mermaid', suppressErrors: true });
      }, 0);
    }
  }, [markdown]);

  const customComponents = {
    // Custom component for code blocks to handle mermaid and masteryls
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      const language = match?.[1];

      if (!inline && language === 'mermaid') {
        return <div className="mermaid">{String(children).replace(/\n$/, '')}</div>;
      }

      // Handle quiz blocks
      if (!inline && language === 'masteryls') {
        const content = String(children).replace(/\n$/, '');
        // Find the masteryls plugin
        const plugin = languagePlugins.find((p) => p.lang === 'masteryls');
        if (plugin?.processor) {
          // Convert the processed HTML to a React element
          const processedHtml = plugin.processor(`<pre lang="masteryls">${content}</pre>`);
          return (
            <div
              dangerouslySetInnerHTML={{ __html: processedHtml }}
              onClick={(e) => {
                const masteryElement = e.target.closest('[data-plugin-masteryls]');
                if (masteryElement && plugin.handler) {
                  plugin.handler(e, masteryElement);
                }
              }}
            />
          );
        }
        return (
          <pre className={className} {...props}>
            <code>{children}</code>
          </pre>
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
                  changeTopic({ ...targetTopic, anchor: hrefAnchor });
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

  return (
    <div ref={containerRef} className={`markdown-body p-4 transition-all duration-300 ease-in-out ${isLoading ? 'opacity-0 bg-black' : 'opacity-100 bg-transparent'}`}>
      {markdown ? (
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={customComponents}>
          {markdown}
        </ReactMarkdown>
      ) : (
        <div className="flex items-center justify-center" />
      )}
    </div>
  );
}
