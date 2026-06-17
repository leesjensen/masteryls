import React from 'react';
import { parseLiteMarkdownBlocks } from '../../../utils/liteMarkdownBlocks.js';
import { HighlightedText } from '../../HighlightedText.jsx';
import { getCurrentSearchTerms } from '../../../hooks/useSearchResults.js';

// lightweight markdown-to-HTML for option text (links, images, strong/em)

function pushHighlightedText(elements, text, searchTerms, key) {
  if (!text) return;

  if (!searchTerms || searchTerms.length === 0) {
    elements.push(text);
    return;
  }

  elements.push(
    <HighlightedText key={key} searchTerms={searchTerms}>
      {text}
    </HighlightedText>,
  );
}

function parseInline(text, searchTerms = []) {
  const elements = [];
  let remaining = text;
  let keyCounter = 0;

  const patterns = [
    // fenced code fallback for inline-only contexts
    {
      regex: /```(?:[a-z]*\n)?([^`]+)```/,
      render: (m, code, key) => (
        <code style={{ backgroundColor: '#eaeaea', padding: '2px 4px', borderRadius: '4px', whiteSpace: 'pre-wrap' }} key={key}>
          <HighlightedText searchTerms={searchTerms}>{code}</HighlightedText>
        </code>
      ),
    },
    // inline code `code`
    {
      regex: /`([^`]+)`/,
      render: (m, code, key) => (
        <code style={{ backgroundColor: '#eaeaea', padding: '2px 4px', borderRadius: '4px' }} key={key}>
          <HighlightedText searchTerms={searchTerms}>{code}</HighlightedText>
        </code>
      ),
    },
    // images ![alt](url)
    { regex: /!\[([^\]]*)\]\(([^)]+)\)/, render: (m, alt, url, key) => <img key={key} alt={alt} src={url} /> },
    // links [text](url)
    {
      regex: /\[([^\]]+)\]\(([^)]+)\)/,
      render: (m, linkText, url, key) => (
        <a key={key} href={url}>
          {parseInline(linkText, searchTerms)}
        </a>
      ),
    },
    // strong **text**
    { regex: /\*\*([^*]+)\*\*/, render: (m, strongText, key) => <strong key={key}>{parseInline(strongText, searchTerms)}</strong> },
    // em _text_ or *text*
    { regex: /(^|[\s(])_([^_]+)_/, render: (m, pre, emText, key) => [pre, <em key={key}>{parseInline(emText, searchTerms)}</em>] },
    { regex: /\*([^*]+)\*/, render: (m, emText, key) => <em key={key}>{parseInline(emText, searchTerms)}</em> },
  ];

  while (remaining.length > 0) {
    let earliestMatch = null;
    let earliestPattern = null;
    let earliestIndex = Infinity;

    // Find the earliest match among all patterns
    for (const pattern of patterns) {
      const match = pattern.regex.exec(remaining);
      if (match && match.index < earliestIndex) {
        earliestMatch = match;
        earliestPattern = pattern;
        earliestIndex = match.index;
      }
    }

    if (earliestMatch) {
      if (earliestIndex > 0) {
        pushHighlightedText(elements, remaining.slice(0, earliestIndex), searchTerms, `text-${keyCounter++}`);
      }

      const key = `${keyCounter++}`;
      const rendered = earliestPattern.render(...earliestMatch, key);
      elements.push(rendered);

      remaining = remaining.slice(earliestIndex + earliestMatch[0].length);
    } else {
      // No more matches, add remaining text
      pushHighlightedText(elements, remaining, searchTerms, `text-${keyCounter++}`);
      break;
    }
  }
  return elements;
}

export function renderLiteMarkdownBlocks(md) {
  if (!md) return null;
  const searchTerms = getCurrentSearchTerms();

  const parsedBlocks = parseLiteMarkdownBlocks(md);
  return parsedBlocks.map((block, index) => {
    if (block.type === 'ul') {
      return (
        <ul key={`list-${index}`} className="list-disc pl-6 my-2">
          {block.items.map((item, itemIndex) => (
            <li key={`list-item-${index}-${itemIndex}`} className="my-1">
              {parseInline(item, searchTerms)}
            </li>
          ))}
        </ul>
      );
    }

    if (block.type === 'ol') {
      return (
        <ol key={`list-${index}`} className="list-decimal pl-6 my-2" start={block.start || 1}>
          {block.items.map((item, itemIndex) => (
            <li key={`list-item-${index}-${itemIndex}`} className="my-1">
              {parseInline(item, searchTerms)}
            </li>
          ))}
        </ol>
      );
    }

    if (block.type === 'code') {
      return (
        <pre key={`code-${index}`} className="my-2 overflow-auto rounded bg-gray-100 p-2 text-sm">
          <code className={block.language ? `language-${block.language}` : undefined}>{block.text}</code>
        </pre>
      );
    }

      return (
        <p key={`p-${index}`} className="my-2">
          {parseInline(block.text, searchTerms)}
        </p>
      );
  });
}

export default function inlineLiteMarkdown(md) {
  if (!md) return null;
  const searchTerms = getCurrentSearchTerms();

  return <>{parseInline(md, searchTerms)}</>;
}
