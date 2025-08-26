import React from 'react';

// lightweight markdown-to-HTML for option text (links, images, strong/em)

export default function inlineLiteMarkdown(md) {
  if (!md) return null;

  // Helper to parse markdown and return an array of JSX elements with keys
  const parse = (text) => {
    const elements = [];
    let remaining = text;
    let match;
    let keyCounter = 0;

    const patterns = [
      // images ![alt](url)
      { regex: /!\[([^\]]*)\]\(([^)]+)\)/, render: (m, alt, url, key) => <img key={key} alt={alt} src={url} /> },
      // links [text](url)
      {
        regex: /\[([^\]]+)\]\(([^)]+)\)/,
        render: (m, text, url, key) => (
          <a key={key} href={url}>
            {parse(text, `${key}-`)}
          </a>
        ),
      },
      // strong **text**
      { regex: /\*\*([^*]+)\*\*/, render: (m, text, key) => <strong key={key}>{parse(text, `${key}-`)}</strong> },
      // em _text_ or *text*
      { regex: /(^|[\s(])_([^_]+)_/, render: (m, pre, text, key) => [pre, <em key={key}>{parse(text, `${key}-`)}</em>] },
      { regex: /\*([^*]+)\*/, render: (m, text, key) => <em key={key}>{parse(text, `${key}-`)}</em> },
    ];

    while (remaining.length > 0) {
      let found = false;
      for (const { regex, render } of patterns) {
        match = regex.exec(remaining);
        if (match && match.index !== undefined) {
          if (match.index > 0) {
            elements.push(remaining.slice(0, match.index));
          }
          const key = `${keyCounter++}`;
          const rendered = render(...match, key);
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
