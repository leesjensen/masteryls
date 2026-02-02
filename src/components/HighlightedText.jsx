import React from 'react';
import CopyToClipboard from './CopyToClipboard';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { ghcolors } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Highlight the search terms in the children
export function HighlightedText({ children, searchTerms }) {
  if (!searchTerms || searchTerms.length === 0 || typeof children !== 'string') return children;

  const text = children;
  const matches = [];

  // Find all matches for all terms
  searchTerms.forEach((term) => {
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedTerm}\\b`, 'gi');
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        text: match[0],
      });
    }
  });

  if (matches.length === 0) return children;

  // Sort matches by start position and remove overlaps
  matches.sort((a, b) => a.start - b.start);
  const nonOverlapping = [];
  matches.forEach((match) => {
    if (nonOverlapping.length === 0 || match.start >= nonOverlapping[nonOverlapping.length - 1].end) {
      nonOverlapping.push(match);
    }
  });

  // Build array of text and highlighted segments
  const parts = [];
  let lastIndex = 0;

  nonOverlapping.forEach((match, index) => {
    // Add text before match
    if (match.start > lastIndex) {
      parts.push(text.slice(lastIndex, match.start));
    }

    // Add highlighted match
    parts.push(
      <mark key={index} className="bg-yellow-300">
        {match.text}
      </mark>,
    );

    lastIndex = match.end;
  });

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <>{parts}</>;
}

// Wrap the given component with a HighlightedText component if it contains text children
export function createHighlightedComponent(Tag, searchTerms) {
  return ({ children, node, ...props }) => {
    if (!searchTerms || searchTerms.length === 0) {
      return <Tag {...props}>{children}</Tag>;
    }

    const processChild = (child) => {
      if (typeof child === 'string') {
        return <HighlightedText searchTerms={searchTerms}>{child}</HighlightedText>;
      }
      return child;
    };

    return <Tag {...props}>{React.Children.map(children, processChild)}</Tag>;
  };
}

// Highlight code blocks with SyntaxHighlighter and highlight search terms within the code
export function renderHighlightedCodeBlock(codeText, language, searchTerms, props) {
  const getStyleFromClassName = (className, stylesheet) => {
    if (!className) {
      return undefined;
    }
    const classNames = Array.isArray(className) ? className : String(className).split(' ');
    return classNames.reduce((acc, cls) => ({ ...acc, ...stylesheet?.[cls] }), {});
  };

  const renderChildren = (children, stylesheet) =>
    children.map((child, index) => {
      if (typeof child?.value === 'string') {
        return createHighlightedComponent('span', searchTerms)({ key: index, children: child.value });
      }

      if (child?.children) {
        const className = child.properties?.className || child.properties?.className?.join(' ');
        const style = {
          ...getStyleFromClassName(className, stylesheet),
          ...child.properties?.style,
        };
        return (
          <span key={index} className={className} style={style}>
            {renderChildren(child.children, stylesheet)}
          </span>
        );
      }

      return null;
    });

  return (
    <div style={{ position: 'relative' }}>
      <CopyToClipboard text={codeText} />
      <SyntaxHighlighter
        language={language}
        style={ghcolors}
        PreTag="div"
        wrapLongLines
        renderer={({ rows, stylesheet }) => (
          <>
            {rows.map((row, rowIndex) => {
              const rowClassName = row.properties?.className || row.properties?.className?.join(' ');
              const rowStyle = {
                ...getStyleFromClassName(rowClassName, stylesheet),
                ...row.properties?.style,
              };
              return (
                <div key={rowIndex} className={rowClassName} style={rowStyle}>
                  {row.children.map((token, tokenIndex) => {
                    const className = token.properties?.className || token.properties?.className?.join(' ');
                    const style = {
                      ...getStyleFromClassName(className, stylesheet),
                      ...token.properties?.style,
                    };
                    return (
                      <span key={tokenIndex} className={className} style={style}>
                        {renderChildren(token.children || [], stylesheet)}
                      </span>
                    );
                  })}
                </div>
              );
            })}
          </>
        )}
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
