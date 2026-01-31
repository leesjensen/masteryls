import React from 'react';
import { useNavigate } from 'react-router-dom';
import CopyToClipboard from './CopyToClipboard';
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
import { scrollToAnchor } from '../utils/utils';
import { PenTool } from 'lucide-react';

export default function Markdown({ learningSession, content, languagePlugins = [], onMakeSectionActive = null }) {
  const navigate = useNavigate();
  const containerRef = React.useRef(null);
  const customComponents = {
    pre({ node, children, ...props }) {
      return (
        <pre style={{ padding: '3px', borderRadius: 0, background: 'transparent' }} {...props}>
          {React.Children.map(children, (child) => (React.isValidElement(child) ? React.cloneElement(child, { isBlock: true }) : child))}
        </pre>
      );
    },
    code({ node, className, children, isBlock, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      const language = match?.[1];

      if (isBlock && language === 'masteryls') {
        // masteryls quiz blocks
        const plugin = languagePlugins.find((p) => p.lang === 'masteryls');
        if (plugin?.processor) {
          const quizBlock = String(children).replace(/\n$/, '');
          const pluginJsx = plugin.processor(quizBlock);
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
      }

      // Use SyntaxHighlighter for fenced code blocks with a language
      if (isBlock) {
        const codeText = String(children).replace(/\n$/, '');
        return (
          <div style={{ position: 'relative' }}>
            <CopyToClipboard text={codeText} />
            <SyntaxHighlighter
              language={language}
              style={ghcolors}
              PreTag="div"
              wrapLongLines
              customStyle={{
                margin: 0, // optional: removes default margin that can mess with layout
              }}
              codeTagProps={{
                style: {
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word', // wrap long words/tokens
                  overflowWrap: 'anywhere', // extra help for super-long tokens
                },
              }}
              {...props}
            >
              {codeText}
            </SyntaxHighlighter>
          </div>
        );
      }

      return (
        <code style={{ wordBreak: 'break-word', whiteSpace: 'pre-line' }} {...props}>
          {children}
        </code>
      );
    },

    // Custom link handler for internal navigation
    // Absolute URL: open in new tab.
    //     https://cow.com
    // Root-relative URL: Specific course and topic.
    //     /course/abc/topic/def
    //     /course/51a72d23-50ab-4147-a1db-27a062aed771/topic/140d86ce9e9b4ce59fd095bb959c9df4
    // Relative URL: relative path to either a topic or a resource of current topic in the current course.
    //     main.java - resource in current topic
    //     ./main.java - resource in current topic
    //     ../simon/simon.md
    //     ../../readme.md
    a({ href, children, ...props }) {
      return (
        <a
          href={href}
          onClick={(e) => {
            e.preventDefault();
            if (href?.startsWith('http')) {
              window.open(href, '_blank', 'noopener,noreferrer');
            } else if (href?.startsWith('/')) {
              navigate(href);
            } else {
              const match = href?.match(/^([^#]*)(#.*)?$/);
              const hrefPath = match?.[1];
              const hrefAnchor = match?.[2];

              if (!hrefPath && hrefAnchor) {
                scrollToAnchor(hrefAnchor, containerRef);
              } else if (hrefPath) {
                const resolvedUrl = new URL(hrefPath, learningSession.topic.path).toString();
                const targetTopic = learningSession.course.topicFromPath(resolvedUrl, false);
                if (targetTopic) {
                  const anchor = hrefAnchor ? `#${hrefAnchor}` : '';
                  navigate(`/course/${learningSession.course.id}/topic/${targetTopic.id}${anchor}`);
                } else {
                  window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
                }
              }
            }
          }}
          {...props}
        >
          {children}
        </a>
      );
    },

    // Handle other plugin elements
    div({ className, children, ...props }) {
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

  if (onMakeSectionActive !== null) {
    // Allow creating notes by clicking on heading, if onMakeSectionActive callback is provided
    const headingComponents = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].reduce((acc, tag) => {
      acc[tag] = ({ children, ...props }) => {
        const HeadingTag = tag;
        const headingText = typeof children === 'string' ? children : String(children);
        const headingId = headingText
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^\w-]/g, '');

        return (
          <HeadingTag
            id={headingId}
            className="flex items-center gap-2 group cursor-pointer"
            onClick={(e) => {
              e.preventDefault();
              onMakeSectionActive(headingId, headingText);
            }}
            title={headingText}
            {...props}
          >
            {children}
            <PenTool className="md:opacity-0 group-hover:opacity-100 transition-opacity w-4 h-4" aria-label={`Add notes for ${headingText}`} />
          </HeadingTag>
        );
      };
      return acc;
    }, {});
    Object.assign(customComponents, headingComponents);
  }

  const components = { ...customComponents, MermaidBlock };

  return (
    <div ref={containerRef}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkEmoji, remarkGithubBlockquoteAlert]} rehypePlugins={[[rehypeRaw], [rehypeMermaid, { mermaidConfig: { theme: 'default' } }]]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
