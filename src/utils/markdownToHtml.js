// Converts Markdown into a small, safe subset of HTML.
//
// Canvas submission comments collapse plain-text newlines and only render line
// breaks and formatting when given HTML (its own comment editor emits HTML too).
// This produces the minimal, sanitizer-friendly HTML needed for readable
// feedback: escaped text, <br> line breaks, <strong> bold (and headings),
// <ul>/<li> bullets, and <code>/<pre> for code.
//
// Two Canvas-specific hazards are handled:
//   1. Stray <, >, and & are HTML-escaped so code snippets cannot inject markup.
//   2. Canvas configures MathJax with the backtick (`) as an ASCIIMath delimiter
//      (alongside \(...\) and $$...$$), so any backtick-delimited span in the
//      feedback would be rendered as garbled math. Markdown code is therefore
//      converted into <code>/<pre> (tags MathJax skips) and every remaining
//      backtick is removed so none can act as a math delimiter.

function escapeHtml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function applyInline(escapedText) {
  return (
    escapedText
      // Inline code: `code` -> <code>code</code> (removes the backtick delimiters)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Drop any leftover unpaired backtick so it cannot start an ASCIIMath span.
      .replace(/`/g, '')
      // Bold: **text** or __text__ -> <strong>text</strong>
      .replace(/(\*\*|__)(.+?)\1/g, '<strong>$2</strong>')
  );
}

/**
 * Convert a Markdown string into a simplified, Canvas-safe HTML string.
 *
 * @param {string} markdown - The Markdown source.
 * @returns {string} HTML using only <br>, <strong>, <ul>, <li>, <code>, and <pre>.
 */
export function markdownToHtml(markdown) {
  if (markdown == null) return '';

  const lines = String(markdown).replace(/\r\n/g, '\n').split('\n');
  const parts = [];
  let listItems = null;
  let codeLines = null; // non-null while inside a fenced code block

  const flushList = () => {
    if (listItems) {
      parts.push(`<ul>${listItems.join('')}</ul>`);
      listItems = null;
    }
  };

  const flushCode = () => {
    if (codeLines) {
      parts.push(`<pre>${codeLines.join('\n')}</pre>`);
      codeLines = null;
    }
  };

  for (const rawLine of lines) {
    if (/^\s*```/.test(rawLine)) {
      // A code fence line toggles the fenced block on/off.
      if (codeLines) {
        flushCode();
      } else {
        flushList();
        codeLines = [];
      }
      continue;
    }

    if (codeLines) {
      // Inside a fence: escape only. MathJax skips <pre>, so backticks here are inert.
      codeLines.push(escapeHtml(rawLine));
      continue;
    }

    const escaped = escapeHtml(rawLine);
    const heading = escaped.match(/^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/);
    if (heading) {
      // Headings become bold labels: real <h1>-<h6> tags inherit Canvas's large
      // heading styling, which looks out of place inside a submission comment.
      flushList();
      parts.push(`<strong>${applyInline(heading[1])}</strong>`);
      continue;
    }

    const bullet = escaped.match(/^\s*[-*+]\s+(.*)$/);
    if (bullet) {
      if (!listItems) listItems = [];
      listItems.push(`<li>${applyInline(bullet[1])}</li>`);
    } else {
      flushList();
      parts.push(applyInline(escaped));
    }
  }
  flushList();
  flushCode(); // an unterminated fence is still emitted as a code block

  // <ul>/<pre> blocks are self-contained; text lines are separated by <br> so
  // Canvas preserves the line breaks it would otherwise collapse.
  return parts.join('<br>');
}

export default markdownToHtml;
