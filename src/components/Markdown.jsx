import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSearchResults } from '../hooks/useSearchResults';
import useLatest from '../hooks/useLatest';
import { createHighlightedComponent, HighlightedText, renderHighlightedCodeBlock } from './HighlightedText';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkEmoji from 'remark-emoji';
import remarkGithubBlockquoteAlert from 'remark-github-blockquote-alert';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { rehypeMermaid, MermaidBlock } from 'react-markdown-mermaid';
import 'github-markdown-css/github-markdown-light.css';
import './markdown.css';
import { scrollToAnchor } from '../utils/utils';
import { resolveMarkdownHref } from '../utils/resolveMarkdownHref';
import { StickyNote } from 'lucide-react';
import { markdownSanitizeSchema, sanitizeInlineStyle } from './markdownSanitize';

const BlockCodeContext = React.createContext(false);

// Stable empty reference so the "no search" case doesn't hand `searchTerms` a fresh array
// identity on every searchResults change (e.g. setSearchResults(null) on course load). A new
// identity would recompute the memoized `components` map below and remount rendered
// interactions, wiping in-progress state.
const EMPTY_SEARCH_TERMS = [];

function markdownUrlTransform(value, key, node) {
  if (key === 'src' && node?.tagName === 'img' && String(value || '').startsWith('blob:')) {
    return value;
  }

  return defaultUrlTransform(value);
}

function extractPlainText(children) {
  return React.Children.toArray(children)
    .map((child) => {
      if (typeof child === 'string') return child;
      if (typeof child === 'number') return String(child);
      if (React.isValidElement(child)) return extractPlainText(child.props.children);
      return '';
    })
    .join('')
    .trim();
}

export default function Markdown({ learningSession, content, languagePlugins = [], noteMessages = [], onMakeHeadingActive = null }) {
  const { searchResults } = useSearchResults();
  const navigate = useNavigate();
  const containerRef = React.useRef(null);
  // These are recreated on every render of our callers (interactionInstruction.jsx builds a
  // fresh languagePlugins array, markdownInstruction.jsx builds a fresh onMakeHeadingActive
  // closure, every time they re-render - which happens on every progress heartbeat). Reading
  // them through refs lets the react-markdown `components` map below stay reference-stable
  // across those re-renders, so react-markdown doesn't remount rendered interactions (e.g. an
  // essay textarea) and wipe unsaved input every ~60s.
  const languagePluginsRef = useLatest(languagePlugins);
  const onMakeHeadingActiveRef = useLatest(onMakeHeadingActive);
  // noteMessages loads asynchronously (after the topic mounts, once the enrollment's notes
  // are fetched). Reading it through a ref - instead of listing it as a `components` memo
  // dependency - keeps the components map reference-stable so react-markdown does NOT remount
  // the rendered subtree (which would wipe in-progress interaction state such as an unsaved
  // essay or checked survey answers). Heading note indicators still update, because the
  // parent's setNoteMessages re-render re-invokes the heading component and re-reads the ref.
  const noteMessagesRef = useLatest(noteMessages);

  // Get search terms for highlighting
  const searchTerms = React.useMemo(() => {
    if (!searchResults || searchResults.matches.length === 0) {
      return EMPTY_SEARCH_TERMS;
    }
    return searchResults.query.trim().split(/\s+/);
  }, [searchResults]);

  const renderInteraction = (children) => {
    const plugin = languagePluginsRef.current.find((p) => p.lang === 'masteryls');
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

  const resolveTopicUrl = React.useCallback(
    (rawPath) => {
      const topicBase = learningSession?.topic?.snapshotPath || learningSession?.topic?.path;
      if (!rawPath || !topicBase) {
        return rawPath;
      }

      try {
        return new URL(rawPath, topicBase).toString();
      } catch {
        return rawPath;
      }
    },
    [learningSession?.topic?.path, learningSession?.topic?.snapshotPath],
  );

  function renderHighlightedChildren(children) {
    return React.Children.map(children, (child, index) => {
      if (typeof child === 'string') {
        return (
          <HighlightedText key={`heading-text-${index}`} searchTerms={searchTerms}>
            {child}
          </HighlightedText>
        );
      }
      return child;
    });
  }

  // Memoized so react-markdown sees stable component identities across renders that don't
  // actually change the topic/course (e.g. the progress heartbeat re-rendering this tree).
  // Unstable identities here would make react-markdown treat elements as a different type
  // and remount the rendered subtree - including interaction state like an in-progress essay.
  // The link/image/navigation handlers need the current topic + resolver, but reading those
  // values as `components` memo dependencies would rebuild the map (and remount every rendered
  // interaction) whenever the topic object is replaced or its snapshotPath resolves async.
  // Reading them through refs keeps the map stable; a genuine topic switch still remounts
  // interactions because the `content` prop passed to ReactMarkdown changes.
  const learningSessionRef = useLatest(learningSession);
  const resolveTopicUrlRef = useLatest(resolveTopicUrl);

  // Resolve a raw markdown href to a real, navigable app URL, so the href attribute is valid
  // whether the click is intercepted (SPA nav) or the browser follows it directly
  // (open-in-new-tab / middle-click / cmd-click). The base topic needed to resolve a relative
  // link is only known here, so the resolved href must be baked in at render time - by the time
  // a bare relative path reaches the router the originating topic (and thus the base) is lost.
  // The resolution rules live in the pure, unit-tested `resolveMarkdownHref` util.
  const resolveHref = React.useCallback((href) => {
    const session = learningSessionRef.current;
    return resolveMarkdownHref(href, {
      topicPath: session?.topic?.path,
      courseId: session?.course?.id,
      topicFromPath: session?.course ? (path, fallback) => session.course.topicFromPath(path, fallback) : undefined,
      resolveTopicUrl: resolveTopicUrlRef.current,
    });
    // Reads only refs (stable), so it never needs to be rebuilt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const components = React.useMemo(() => {
    const customComponents = {
      pre({ node, children, ...props }) {
        return (
          <pre style={{ padding: '3px', borderRadius: 0, background: 'transparent' }} {...props}>
            <BlockCodeContext.Provider value={true}>{children}</BlockCodeContext.Provider>
          </pre>
        );
      },
      code({ node, className, children, ...props }) {
        const isBlock = React.useContext(BlockCodeContext);
        const match = /language-(\w+)/.exec(className || '');
        const language = match?.[1];

        // masteryls interaction
        if (isBlock && language === 'masteryls') {
          return renderInteraction(children);
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
      table({ node, children, ...props }) {
        return (
          <div className="markdown-table-scroll" role="region" aria-label="Scrollable table">
            <table {...props}>{children}</table>
          </div>
        );
      },
      td: createHighlightedComponent('td', searchTerms),
      th: createHighlightedComponent('th', searchTerms),
      blockquote: createHighlightedComponent('blockquote', searchTerms),
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
        const resolvedSrc = src && !src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('/') ? resolveTopicUrlRef.current(src) : src;
        return <source src={resolvedSrc} {...props} />;
      },

      img({ node, src, ...props }) {
        const resolvedSrc = src && !src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('/') ? resolveTopicUrlRef.current(src) : src;
        return <img src={resolvedSrc} {...props} />;
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
      a({ node, href, children, ...props }) {
        const resolvedHref = resolveHref(href);
        return (
          <a
            href={resolvedHref}
            onClick={(e) => {
              // Let modified clicks (new tab / new window / download) fall through to the
              // browser, which uses the now-valid resolvedHref attribute.
              if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              e.preventDefault();
              if (resolvedHref?.startsWith('http')) {
                window.open(resolvedHref, '_blank', 'noopener,noreferrer');
              } else if (resolvedHref?.startsWith('/')) {
                navigate(resolvedHref);
              } else if (resolvedHref?.startsWith('#')) {
                scrollToAnchor(resolvedHref, containerRef);
              }
            }}
            {...props}
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
          const plugin = languagePluginsRef.current.find((p) => p.lang === pluginLang);
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

    if (onMakeHeadingActiveRef.current !== null) {
      // Modify heading components to include StickyNote icon and heading ID
      const headingComponents = ['h2', 'h3', 'h4'].reduce((acc, tag) => {
        acc[tag] = ({ node, children, className, ...props }) => {
          const HeadingTag = tag;
          const headingText = extractPlainText(children);
          const headingId = headingText
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^\w-]/g, '');

          const existingNote = noteMessagesRef.current.find((note) => note.section === headingText);

          return (
            <HeadingTag
              id={headingId}
              className={`flex items-center gap-2 cursor-pointer ${className || ''}`.trim()}
              {...props}
              onClick={() => {
                const session = learningSessionRef.current;
                navigate(`/course/${session.course.id}/topic/${session.topic.id}#${headingId}`);
              }}
            >
              {renderHighlightedChildren(children)}
              <span title={`${existingNote ? 'View' : 'Add'} notes for this section`}>
                <StickyNote
                  size={12}
                  className={`cursor-pointer transition-colors ${existingNote ? 'text-yellow-500 fill-yellow-100' : 'text-gray-400 hover:text-yellow-300'}`}
                  onClick={() => {
                    onMakeHeadingActiveRef.current(headingText);
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

    return { ...customComponents, MermaidBlock };
    // Depends ONLY on things that change how nodes render (search highlighting, whether
    // headings get the note affordance). Everything topic/course/session-derived is read via
    // refs above (languagePlugins, onMakeHeadingActive, noteMessages, learningSession,
    // resolveTopicUrl) so replacing the topic object or resolving its snapshotPath does NOT
    // rebuild this map and remount rendered interactions. Genuine topic switches remount
    // naturally because the `content` string passed to ReactMarkdown changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerms, navigate, Boolean(onMakeHeadingActive)]);

  return (
    <div ref={containerRef}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkEmoji, remarkGithubBlockquoteAlert]} rehypePlugins={[[rehypeRaw], [rehypeSanitize, markdownSanitizeSchema], [rehypeMermaid, { mermaidConfig: { theme: 'default', securityLevel: 'strict' } }]]} components={components} urlTransform={markdownUrlTransform}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
