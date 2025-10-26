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
      let found = false;
      for (const { regex, render } of patterns) {
        console.log(remaining);
        match = regex.exec(remaining);
        if (match && match.index !== undefined) {
          console.log(regex, match[1]);
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
