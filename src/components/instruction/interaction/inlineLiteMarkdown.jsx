import React from 'react';
import { parseLiteMarkdownBlocks } from '../../../utils/liteMarkdownBlocks.js';

// lightweight markdown-to-HTML for option text (links, images, strong/em)

function parseInline(text) {
  const elements = [];
  let remaining = text;
  let keyCounter = 0;

  const patterns = [
    // code blocks ```code```
    {
      regex: /```(?:[a-z]*\n)?([^`]+)```/,
      render: (m, code, key) => (
        <pre style={{ backgroundColor: '#eaeaea', padding: '8px', borderRadius: '4px' }} key={key}>
          <code>{code}</code>
        </pre>
      ),
    },
    // inline code `code`
    {
      regex: /`([^`]+)`/,
      render: (m, code, key) => (
        <code style={{ backgroundColor: '#eaeaea', padding: '2px 4px', borderRadius: '4px' }} key={key}>
          {code}
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
          {parseInline(linkText)}
        </a>
      ),
    },
    // strong **text**
    { regex: /\*\*([^*]+)\*\*/, render: (m, strongText, key) => <strong key={key}>{parseInline(strongText)}</strong> },
    // em _text_ or *text*
    { regex: /(^|[\s(])_([^_]+)_/, render: (m, pre, emText, key) => [pre, <em key={key}>{parseInline(emText)}</em>] },
    { regex: /\*([^*]+)\*/, render: (m, emText, key) => <em key={key}>{parseInline(emText)}</em> },
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
        elements.push(remaining.slice(0, earliestIndex));
      }

      const key = `${keyCounter++}`;
      const rendered = earliestPattern.render(...earliestMatch, key);
      elements.push(rendered);

      remaining = remaining.slice(earliestIndex + earliestMatch[0].length);
    } else {
      // No more matches, add remaining text
      elements.push(remaining);
      break;
    }
  }
  return elements;
}

export function renderLiteMarkdownBlocks(md) {
  if (!md) return null;

  const parsedBlocks = parseLiteMarkdownBlocks(md);
  return parsedBlocks.map((block, index) => {
    if (block.type === 'ul') {
      return (
        <ul key={`list-${index}`} className="list-disc pl-6 my-2">
          {block.items.map((item, itemIndex) => (
            <li key={`list-item-${index}-${itemIndex}`} className="my-1">
              {parseInline(item)}
            </li>
          ))}
        </ul>
      );
    }

    return (
      <p key={`p-${index}`} className="my-2">
        {parseInline(block.text)}
      </p>
    );
  });
}

export default function inlineLiteMarkdown(md) {
  if (!md) return null;

  return <>{parseInline(md)}</>;
}
