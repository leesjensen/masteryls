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
      // code blocks ```code```
      {
        regex: /```(?:[a-z]*\n)?([^`]+)```/,
        render: (m, code, key) => (
          <pre key={key}>
            <code>{code}</code>
          </pre>
        ),
      },
      // inline code `code`
      {
        regex: /`([^`]+)`/,
        render: (m, code, key) => (
          <code style={{ backgroundColor: '#f0f0f0', padding: '2px 4px', borderRadius: '4px' }} key={key}>
            {code}
          </code>
        ),
      },
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
  };

  return <>{parse(md)}</>;
}
