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
    pre({ node, children, className, ...props }) {
      return <pre style={{ padding: '3px', borderRadius: 0, background: 'transparent' }}>{children}</pre>;
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

    // Static link handler - just render regular anchor tags
    a({ href, children, ...props }) {
      //   if (href && href.startsWith('../')) {
      //     href = href.replace(/^\.\.\//, '../pages/');
      //   }
      return (
        <a href={href} {...props}>
          {children}
        </a>
      );
    },

    source({ src, ...props }) {
      if (src && !src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('/')) {
        src = new URL(src, topic.path).href;
      }
      return <source src={src} {...props} />;
    },

    img({ src, ...props }) {
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
