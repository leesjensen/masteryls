import React from 'react';

// Helper component to highlight search terms in text
export default function HighlightedText({ children, searchTerms }) {
  if (!searchTerms || searchTerms.length === 0 || typeof children !== 'string') {
    return children;
  }

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

  // No matches found
  if (matches.length === 0) {
    return children;
  }

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

// Helper to create components that highlight text children
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
