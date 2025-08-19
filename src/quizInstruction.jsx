// QuizInstruction.jsx
import React from 'react';
import MarkdownInstruction from './markdownInstruction';

// lightweight markdown-to-HTML for option text (links, images, strong/em)
function inlineLiteMarkdown(md) {
  if (!md) return '';
  let s = md;
  // images ![alt](url)
  s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => `<img alt="${escapeHtml(alt)}" src="${escapeHtml(url)}">`);
  // links [text](url)
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => `<a href="${escapeHtml(url)}">${escapeHtml(text)}</a>`);
  // strong **text**
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // em _text_ or *text*
  s = s.replace(/(^|[\s(])_([^_]+)_/g, '$1<em>$2</em>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // basic escapes for remaining
  return s;
}
function escapeHtml(s) {
  return String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

// Turn a language-masteryls code fence into an interactive quiz div string
function renderQuizHtmlFromFence(raw) {
  // raw is the text content inside the code fence (exactly what you wrote in markdown)
  // Expect: first JSON object line, then "- [ ]" / "- [x]" items
  const jsonMatch = raw.match(/\{[\s\S]*?\}/);
  let meta = { id: undefined, title: 'Quiz', type: 'multiple-choice' };
  let itemsText = raw;

  if (jsonMatch) {
    try {
      meta = { ...meta, ...JSON.parse(jsonMatch[0]) };
    } catch {}
    itemsText = raw.slice(jsonMatch.index + jsonMatch[0].length).trim();
  }

  const lines = itemsText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('- ['));
  const items = lines.map((line) => {
    const correct = /^\-\s*\[\s*[xX]\s*\]/.test(line);
    const text = line.replace(/^\-\s*\[\s*[xX ]\s*\]\s*/, '').trim();
    return { text, correct };
  });

  const single = (meta.type || '').toLowerCase() === 'single-choice' || items.filter((i) => i.correct).length === 1;

  // Build HTML with data attributes for delegation
  const inputsHtml = items
    .map((it, i) => {
      const input = `<input type="${single ? 'radio' : 'checkbox'}"
                             name="quiz-${meta.id ?? 'x'}"
                             data-quiz-index="${i}"
                             ${it.correct ? 'data-quiz-correct="true"' : ''}
                             class="mt-1" />`;
      const label = `<label class="cursor-pointer">${inlineLiteMarkdown(it.text)}</label>`;
      return `<div class="flex items-start gap-2">${input}${label}</div>`;
    })
    .join('');

  return `
    <div class="my-6 p-4 rounded-2xl border shadow-sm"
         data-quiz-root
         data-quiz-id="${meta.id ?? ''}"
         data-quiz-title="${escapeHtml(meta.title || '')}"
         data-quiz-type="${escapeHtml(meta.type || (single ? 'single-choice' : 'multiple-choice'))}">
      <fieldset>
        ${meta.title ? `<legend class="font-semibold mb-3">${escapeHtml(meta.title)}</legend>` : ''}
        <div class="space-y-3">
          ${inputsHtml}
        </div>
        <button type="button"
                class="mt-4 px-4 py-2 rounded-xl border shadow-sm hover:shadow transition"
                data-quiz-submit>
          Submit
        </button>
      </fieldset>
    </div>
  `;
}

function injectQuizzesIntoHtml(html) {
  if (!html || typeof html !== 'string') return html;

  // Parse into a DOM to safely locate <code class="language-masteryls">…</code>
  const root = document.createElement('div');
  root.innerHTML = html;

  const codeBlocks = root.querySelectorAll('pre[lang="masteryls"]');
  codeBlocks.forEach((codeEl) => {
    // Most renderers wrap <code> inside <pre>; we’ll replace the <pre> with quiz
    const pre = codeEl.closest('pre') || codeEl;
    const raw = codeEl.textContent || '';

    const quizHtml = renderQuizHtmlFromFence(raw);
    const temp = document.createElement('div');
    temp.innerHTML = quizHtml;

    pre.replaceWith(...temp.childNodes);
  });

  return root.innerHTML;
}

export default function QuizInstruction(props) {
  const { topic, changeTopic, course } = props;

  function OnQuizSubmit(result) {
    // Your submission logic here. You get:
    // { id, title, type, selectedIndices, correctIndices, isCorrect }
    // Example:
    // console.log('quiz submit', result);
  }

  return (
    <MarkdownInstruction
      topic={topic}
      changeTopic={changeTopic}
      course={course}
      postProcessHtml={injectQuizzesIntoHtml} // NEW: inject quizzes
      onQuizSubmit={OnQuizSubmit} // NEW: handle submit
    />
  );
}
