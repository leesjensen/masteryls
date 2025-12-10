import React from 'react';
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

/**
 * Static version of Markdown component for server-side rendering (no router hooks)
 */
export default function MarkdownStatic({ course, topic, content, languagePlugins = [] }) {
  const customComponents = {
    pre({ node, children, ...props }) {
      return (
        <pre style={{ padding: '3px', borderRadius: 0, background: 'transparent' }} {...props}>
          {children}
        </pre>
      );
    },
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      const language = match?.[1];

      // Throw away masteryls plugin blocks in static rendering
      if (!inline && language === 'masteryls') {
        return (
          <div>
            This <a href={`https://masteryls.com/course/${course.id}/topic/${topic.id}`}>Mastery LS quiz</a> is not available in Canvas.
          </div>
        );
      }

      // Use SyntaxHighlighter for fenced code blocks with a language
      if (!inline && language) {
        const codeText = String(children).replace(/\n$/, '');
        return (
          <SyntaxHighlighter language={language} style={ghcolors} PreTag="div">
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

    a({ node, href, children, ...props }) {
      let src = null;
      if (href?.startsWith('http')) {
        src = href;
      } else if (href?.startsWith('/')) {
        const match = href.match(/\/course\/([^/]+)\/topic\/([^/]+)/);
        if (match) {
          const [, courseId, topicId] = match;
          if (courseId === course.id) {
            const targetTopic = course.topicFromId(topicId);
            if (targetTopic && targetTopic.externalRefs?.canvasPageId) {
              src = `./${targetTopic.externalRefs.canvasPageId}`;
            }
          } else {
            // we could look up the course and see if it has a canvasCourseId, but for now, just link to the masteryls site
            src = `https://masteryls.com/course/${courseId}/topic/${topicId}`;
          }
        }
      } else {
        const match = href?.match(/^([^#]*)(#.*)?$/);
        const hrefPath = match?.[1];
        const hrefAnchor = match?.[2];

        const resolvedUrl = new URL(hrefPath, topic.path).toString();
        const targetTopic = course.topicFromPath(resolvedUrl, false);
        if (targetTopic && targetTopic.externalRefs?.canvasPageId) {
          src = `./${targetTopic.externalRefs.canvasPageId}${hrefAnchor || ''}`;
        } else {
          src = resolvedUrl + (hrefAnchor || '');
        }
      }

      if (src) {
        return (
          <a href={src} {...props}>
            {children}
          </a>
        );
      }
      return children;
    },

    source({ node, src, ...props }) {
      if (src && !src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('/')) {
        src = new URL(src, topic.path).href;
      }
      return <source src={src} {...props} />;
    },

    img({ node, src, ...props }) {
      if (src && !src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('/')) {
        src = new URL(src, topic.path).href;
      }
      return <img src={src} {...props} />;
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
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkEmoji, remarkGithubBlockquoteAlert]} rehypePlugins={[[rehypeRaw], [rehypeMermaid, { mermaidConfig: { theme: 'default' } }]]} components={components}>
      {content}
    </ReactMarkdown>
  );
}
