import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkEmoji from 'remark-emoji';
import remarkGithubBlockquoteAlert from 'remark-github-blockquote-alert';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { rehypeMermaid, MermaidBlock } from 'react-markdown-mermaid';
import 'github-markdown-css/github-markdown-light.css';
import './markdown.css';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { ghcolors } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { markdownSanitizeSchema, sanitizeInlineStyle } from './markdownSanitize';

/**
 * Static version of Markdown component for server-side rendering (no router hooks)
 */
// A topic can be linked to Canvas as a page, quiz, or assignment (see canvasSync.js's
// topicCanvasTarget) - resolve whichever one actually exists, as a root-relative Canvas
// path so the link works regardless of which Canvas domain the course lives on.
function resolveCanvasResourcePath(canvasCourseId, targetTopic, hrefAnchor = '') {
  const refs = targetTopic?.externalRefs;
  if (!canvasCourseId || !refs) return null;
  if (refs.canvasPageId) return `/courses/${canvasCourseId}/pages/${refs.canvasPageId}${hrefAnchor}`;
  if (refs.canvasQuizId) return `/courses/${canvasCourseId}/quizzes/${refs.canvasQuizId}${hrefAnchor}`;
  if (refs.canvasAssignmentId) return `/courses/${canvasCourseId}/assignments/${refs.canvasAssignmentId}${hrefAnchor}`;
  return null;
}

export default function MarkdownStatic({ course, topic, content, languagePlugins = [] }) {
  const topicBasePath = topic?.snapshotPath || topic?.path;

  const customComponents = {
    pre({ node, children, ...props }) {
      return (
        <pre style={{ padding: '3px', borderRadius: 0, background: 'transparent', fontSize: '15px', lineHeight: 1.5 }} {...props}>
          {children}
        </pre>
      );
    },
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      const language = match?.[1];
      // In react-markdown v10+, determine inline vs block by checking for language class
      // Fenced code blocks have a language-* class, inline code doesn't
      const isInline = !match;

      // Throw away masteryls plugin blocks in static rendering
      if (!isInline && language === 'masteryls') {
        return null;
        // return (
        //   <div style={{ fontFamily: 'helvetica, arial, sans-serif', fontSize: '1.5em', padding: '1em', border: '3px solid #e58e00', borderRadius: '4px', backgroundColor: '#fffaf0', color: '#262626' }}>
        //     View this content in{' '}
        //     <a style={{ color: '#262626', textDecoration: 'underline' }} href={`https://masteryls.com/course/${course.id}/topic/${topic.id}`}>
        //       MasteryLS
        //     </a>
        //     .
        //   </div>
        // );
      }

      // Use SyntaxHighlighter for fenced code blocks with a language
      if (!isInline && language) {
        const codeText = String(children).replace(/\n$/, '');
        return (
          <SyntaxHighlighter
            language={language}
            style={ghcolors}
            PreTag="div"
            customStyle={{ fontSize: '15px', lineHeight: 1.5, padding: '12px', borderRadius: '4px' }}
            codeTagProps={{ style: { fontSize: '15px', lineHeight: 1.5, fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", monospace' } }}
          >
            {codeText}
          </SyntaxHighlighter>
        );
      }

      return (
        <code className={className} style={{ fontSize: '0.95em' }} {...props}>
          {children}
        </code>
      );
    },

    a({ node, href, children, ...props }) {
      let src = null;
      if (href?.startsWith('http')) {
        src = href;
      } else if (href?.startsWith('/')) {
        const match = href.match(/\/course\/([^/#]+)\/topic\/([^/#]+)(#.*)?$/);
        if (match) {
          const [, courseId, topicId, hrefAnchor = ''] = match;
          if (courseId === course.id) {
            const targetTopic = course.topicFromId(topicId);
            // Prefer linking directly to the Canvas page/quiz/assignment for the target
            // topic (whichever type it was linked as); fall back to the MasteryLS URL
            // rather than dropping the link entirely when no Canvas resource exists yet.
            src = resolveCanvasResourcePath(course.externalRefs?.canvasCourseId, targetTopic, hrefAnchor) || `https://masteryls.com/course/${courseId}/topic/${topicId}${hrefAnchor}`;
          } else {
            // we could look up the course and see if it has a canvasCourseId, but for now, just link to the masteryls site
            src = `https://masteryls.com/course/${courseId}/topic/${topicId}${hrefAnchor}`;
          }
        }
      } else {
        const match = href?.match(/^([^#]*)(#.*)?$/);
        const hrefPath = match?.[1];
        const hrefAnchor = match?.[2] || '';

        const canonicalResolvedUrl = new URL(hrefPath, topic.path).toString();
        const resolvedUrl = new URL(hrefPath, topicBasePath).toString();
        const targetTopic = course.topicFromPath(canonicalResolvedUrl, false);
        const canvasResourcePath = resolveCanvasResourcePath(course.externalRefs?.canvasCourseId, targetTopic, hrefAnchor);
        if (canvasResourcePath) {
          src = canvasResourcePath;
        } else if (targetTopic) {
          // The relative link resolves to a real topic in this course, but that topic
          // hasn't been linked to Canvas yet (or the course itself isn't Canvas-linked) -
          // send it to MasteryLS rather than the raw source file, matching how the
          // /course/.../topic/... link branch above falls back.
          src = `https://masteryls.com/course/${course.id}/topic/${targetTopic.id}${hrefAnchor}`;
        } else {
          // Not a topic at all (e.g. an image, PDF, or other repo file) - link straight to
          // the raw resolved content.
          src = resolvedUrl + hrefAnchor;
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
    span({ node, style, children, ...props }) {
      const safeStyle = sanitizeInlineStyle(style);
      return (
        <span style={safeStyle} {...props}>
          {children}
        </span>
      );
    },
    iframe({ node, src, loading, referrerPolicy, referrerpolicy, sandbox, ...props }) {
      if (!src || !src.startsWith('https://')) {
        return null;
      }

      return <iframe src={src} loading={loading || 'lazy'} referrerPolicy={referrerPolicy || referrerpolicy || 'strict-origin-when-cross-origin'} sandbox={sandbox || 'allow-scripts allow-same-origin allow-presentation'} {...props} />;
    },

    source({ node, src, ...props }) {
      if (src && !src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('/')) {
        src = new URL(src, topicBasePath).href;
      }
      return <source src={src} {...props} />;
    },

    img({ node, src, ...props }) {
      if (src && !src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('/')) {
        src = new URL(src, topicBasePath).href;
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
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkEmoji, remarkGithubBlockquoteAlert]} rehypePlugins={[[rehypeRaw], [rehypeSanitize, markdownSanitizeSchema], [rehypeMermaid, { mermaidConfig: { theme: 'default', securityLevel: 'strict' } }]]} components={components}>
      {content}
    </ReactMarkdown>
  );
}
