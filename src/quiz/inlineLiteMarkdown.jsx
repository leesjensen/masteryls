import React from 'react';

// lightweight markdown-to-HTML for option text (links, images, strong/em)

export default function inlineLiteMarkdown(md) {
  if (!md) return null;

  // Helper to parse markdown and return an array of JSX elements
  const parse = (text) => {
    const elements = [];
    let remaining = text;
    let match;
    const patterns = [
      // images ![alt](url)
      { regex: /!\[([^\]]*)\]\(([^)]+)\)/, render: (m, alt, url) => <img alt={alt} src={url} /> },
      // links [text](url)
      { regex: /\[([^\]]+)\]\(([^)]+)\)/, render: (m, text, url) => <a href={url}>{parse(text)}</a> },
      // strong **text**
      { regex: /\*\*([^*]+)\*\*/, render: (m, text) => <strong>{parse(text)}</strong> },
      // em _text_ or *text*
      { regex: /(^|[\s(])_([^_]+)_/, render: (m, pre, text) => [pre, <em>{parse(text)}</em>] },
      { regex: /\*([^*]+)\*/, render: (m, text) => <em>{parse(text)}</em> },
    ];

    while (remaining.length > 0) {
      let found = false;
      for (const { regex, render } of patterns) {
        match = regex.exec(remaining);
        if (match && match.index !== undefined) {
          if (match.index > 0) {
            elements.push(remaining.slice(0, match.index));
          }
          const rendered = render(...match);
          if (Array.isArray(rendered)) {
            elements.push(...rendered);
          } else {
            elements.push(rendered);
          }
          remaining = remaining.slice(match.index + match[0].length);
          found = true;
          break;
        }
      }
      if (!found) {
        elements.push(remaining);
        break;
      }
    }
    return elements;
  };

  return <>{parse(md)}</>;
}
