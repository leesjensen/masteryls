import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSearchResults } from '../hooks/useSearchResults';
import { createHighlightedComponent, renderHighlightedCodeBlock } from './HighlightedText';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkEmoji from 'remark-emoji';
import remarkGithubBlockquoteAlert from 'remark-github-blockquote-alert';
import rehypeRaw from 'rehype-raw';
import { rehypeMermaid, MermaidBlock } from 'react-markdown-mermaid';
import 'github-markdown-css/github-markdown-light.css';
import './markdown.css';
import { scrollToAnchor } from '../utils/utils';
import { StickyNote } from 'lucide-react';

export default function Markdown({ learningSession, content, languagePlugins = [], noteMessages = [], onMakeHeadingActive = null }) {
  const { searchResults } = useSearchResults();
  const navigate = useNavigate();
  const containerRef = React.useRef(null);

  // Get search terms for highlighting
  const searchTerms = React.useMemo(() => {
    if (!searchResults || searchResults.matches.length === 0) {
      return [];
    }
    return searchResults.query.trim().split(/\s+/);
  }, [searchResults]);

  const renderInteraction = (children, languagePlugins) => {
    const plugin = languagePlugins.find((p) => p.lang === 'masteryls');
    if (!plugin?.processor) {
      return null;
    }

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
  };

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

      // masteryls interaction
      if (isBlock && language === 'masteryls') {
        return renderInteraction(children, languagePlugins);
      }
      // Use SyntaxHighlighter for fenced code blocks with or without a language
      else if (isBlock) {
        const codeText = String(children).replace(/\n$/, '');
        return renderHighlightedCodeBlock(codeText, language, searchTerms, props);
      }

      return createHighlightedComponent('code', searchTerms)({ children, node, ...props });
    },

    // Wrap text nodes to enable highlighting
    strong: createHighlightedComponent('strong', searchTerms),
    p: createHighlightedComponent('p', searchTerms),
    h1: createHighlightedComponent('h1', searchTerms),
    h2: createHighlightedComponent('h2', searchTerms),
    h3: createHighlightedComponent('h3', searchTerms),
    h4: createHighlightedComponent('h4', searchTerms),
    h5: createHighlightedComponent('h5', searchTerms),
    h6: createHighlightedComponent('h6', searchTerms),
    li: createHighlightedComponent('li', searchTerms),
    td: createHighlightedComponent('td', searchTerms),
    th: createHighlightedComponent('th', searchTerms),
    blockquote: createHighlightedComponent('blockquote', searchTerms),

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

  if (onMakeHeadingActive !== null) {
    // Modify heading components to include StickyNote icon and heading ID
    const headingComponents = ['h2', 'h3', 'h4'].reduce((acc, tag) => {
      acc[tag] = (allProps) => {
        const { children, className, ...props } = allProps;
        delete props.node;

        const HeadingTag = tag;
        const headingText = typeof children === 'string' ? children : String(children);
        const headingId = headingText
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^\w-]/g, '');

        const existingNote = noteMessages.find((note) => note.section === headingText);

        return (
          <HeadingTag
            id={headingId}
            className={`flex items-center gap-2 cursor-pointer ${className || ''}`.trim()}
            {...props}
            onClick={() => {
              navigate(`/course/${learningSession.course.id}/topic/${learningSession.topic.id}#${headingId}`);
            }}
          >
            {children}
            <span title={`${existingNote ? 'View' : 'Add'} notes for this section`}>
              <StickyNote
                size={12}
                className={`cursor-pointer transition-colors ${existingNote ? 'text-yellow-500 fill-yellow-100' : 'text-gray-400 hover:text-yellow-300'}`}
                onClick={() => {
                  onMakeHeadingActive(headingText);
                }}
              />
            </span>
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
