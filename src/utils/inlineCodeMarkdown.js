// AI models often emit LaTeX/MathJax `$...$` (e.g. `$m_1$`), which the Markdown renderer does not
// support — it only renders inline code in backticks. INLINE_CODE_PROMPT_GUIDELINE steers generation
// toward backticks, and convertMathDelimitersToInlineCode is a safety net that rewrites stragglers.

export const INLINE_CODE_PROMPT_GUIDELINE = 'Use backticks (`) for inline code, variable names, identifiers, and math/notation — for example `m_1`, `H(m)`, or `O(n log n)`. Never use LaTeX or MathJax `$...$` or `$$...$$` delimiters; the renderer does not support them. Wrap any such expression in backticks instead.';

const MATH_MARKER = /[\\^_{}=+<>|()]/;

function wrapCode(inner) {
  const content = String(inner).trim().replace(/`/g, '');
  return content ? `\`${content}\`` : '';
}

function convertDollars(text) {
  return text
    .replace(/\$\$([^\n$]+?)\$\$/g, (match, inner) => {
      if (inner.trim() !== inner || !inner.trim()) return match;
      return /[A-Za-z]/.test(inner) ? wrapCode(inner) : match;
    })
    .replace(/\$([^\n$]+?)\$/g, (match, inner) => {
      // A span padded with whitespace, or without a letter, is prose/currency (e.g. "$5 and $10") — leave it.
      if (inner.trim() !== inner || !/[A-Za-z]/.test(inner)) return match;
      const codeLike = MATH_MARKER.test(inner) || inner.startsWith('\\') || !/\s/.test(inner);
      return codeLike ? wrapCode(inner) : match;
    });
}

/**
 * Rewrite LaTeX/MathJax `$...$` (and `$$...$$`) math delimiters to Markdown inline code. Fenced code
 * blocks and existing inline-code spans are left verbatim, and currency/prose like "$5 and $10" is
 * not touched (only letter-bearing, code-like spans are converted).
 */
export function convertMathDelimitersToInlineCode(markdown) {
  const text = String(markdown || '');
  return text
    .split(/(```[\s\S]*?```|~~~[\s\S]*?~~~)/g)
    .map((block, blockIdx) => {
      if (blockIdx % 2 === 1) return block; // fenced code block — verbatim
      return block
        .split(/(`[^`\n]+`)/g)
        .map((span, spanIdx) => (spanIdx % 2 === 1 ? span : convertDollars(span)))
        .join('');
    })
    .join('');
}
