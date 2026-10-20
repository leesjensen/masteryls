import { headingSlug } from './headingSlug.js';

// Reduce the inline markdown commonly found in a heading to the plain text that
// react-markdown would render, so the slug computed here matches the heading's DOM id
// (Markdown.jsx slugs the rendered text). Handles links (keep the text), images (drop),
// inline code, and emphasis/strong markers; exotic formatting is best-effort.
function headingPlainText(raw) {
  return String(raw || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images -> nothing (an <img> contributes no text)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> their text
    .replace(/`([^`]+)`/g, '$1') // inline code
    .replace(/(\*\*\*|\*\*|\*)([^*]+)\1/g, '$2') // ***bold-italic**/**bold**/*italic* (asterisk form)
    .replace(/(___|__|_)([^_]+)\1/g, '$2') // ___/__/_ emphasis (underscore form)
    .trim();
}

// Parse the level-2 (`##`) ATX headings from topic markdown, in document order, skipping any
// that fall inside a fenced code block (``` or ~~~), which includes masteryls interaction
// blocks. Returns [{ text, slug }]. Setext (`---` underline) headings are not detected.
export function parseTopicHeadings(markdown) {
  const lines = String(markdown || '').split('\n');
  const headings = [];
  let fence = null; // the marker ('```' or '~~~') that opened the current code block

  for (const line of lines) {
    const fenceMatch = line.match(/^ {0,3}(```+|~~~+)/);
    if (fence) {
      // A line opening with the same fence character closes the block.
      if (fenceMatch && fenceMatch[1][0] === fence[0]) {
        fence = null;
      }
      continue;
    }
    if (fenceMatch) {
      fence = fenceMatch[1];
      continue;
    }

    // Exactly two leading '#', then required whitespace (so '###' is not matched), then the
    // text, with any optional trailing '#' closing sequence stripped.
    const headingMatch = line.match(/^ {0,3}##[ \t]+(.+?)[ \t]*#*[ \t]*$/);
    if (headingMatch) {
      const text = headingPlainText(headingMatch[1]);
      if (text) {
        headings.push({ text, slug: headingSlug(text) });
      }
    }
  }

  return headings;
}
