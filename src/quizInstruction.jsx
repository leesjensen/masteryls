import React from 'react';
import MarkdownInstruction from './markdownInstruction';

function injectQuiz(html) {
  if (!html || typeof html !== 'string') return html;

  // Parse into a DOM to safely locate <pre lang="masteryls">…</pre>
  const root = document.createElement('div');
  root.innerHTML = html;

  const codeBlocks = root.querySelectorAll('pre[lang="masteryls"]');
  codeBlocks.forEach((codeEl) => {
    const pre = codeEl.closest('pre') || codeEl;
    const raw = codeEl.textContent || '';

    const temp = document.createElement('div');
    temp.innerHTML = renderQuizHtmlFromFence(raw);

    pre.replaceWith(...temp.childNodes);
  });

  return root.innerHTML;
}

/**
 * The quiz markdown format follow this example syntax:
 *
 * ```masteryls
 * {"id":"39283", "title":"Multiple choice", "type":"multiple-choice" }
 * - [ ] This is **not** the right answer
 * - [x] This is _the_ right answer
 * - [ ] This one has a [link](https://cow.com)
 * - [ ] This one has an image ![Stock Photo](https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80)
 * ```
 */
function renderQuizHtmlFromFence(raw) {
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

  const useRadioButtons = (meta.type || '').toLowerCase() === 'multiple-choice';

  const inputsHtml = items
    .map((it, i) => {
      const input = `<input type="${useRadioButtons ? 'radio' : 'checkbox'}"
                             name="quiz-${meta.id ?? 'x'}"
                             data-plugin-masteryls-index="${i}"
                             ${it.correct ? 'data-plugin-masteryls-correct="true"' : ''}
                             class="mt-1" />`;
      const label = `<label class="cursor-pointer">${inlineLiteMarkdown(it.text)}</label>`;
      return `<div class="flex items-start gap-2">${input}${label}</div>`;
    })
    .join('');

  return `
    <div class="my-6 p-4 rounded-2xl border shadow-sm"
         data-plugin-masteryls
         data-plugin-masteryls-root
         data-plugin-masteryls-id="${meta.id ?? ''}"
         data-plugin-masteryls-title="${meta.title}"
         data-plugin-masteryls-type="${meta.type}">
      <fieldset>
        ${meta.title ? `<legend class="font-semibold mb-3">${meta.title}</legend>` : ''}
        ${meta.body ? `<p class="mb-3">${inlineLiteMarkdown(meta.body)}</p>` : ''}
        <div class="space-y-3">
          ${inputsHtml}
        </div>
      </fieldset>
    </div>
  `;
}

// lightweight markdown-to-HTML for option text (links, images, strong/em)
function inlineLiteMarkdown(md) {
  if (!md) return '';
  let s = md;
  // images ![alt](url)
  s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => `<img alt="${alt}" src="${url}">`);
  // links [text](url)
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => `<a href="${url}">${text}</a>`);
  // strong **text**
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // em _text_ or *text*
  s = s.replace(/(^|[\s(])_([^_]+)_/g, '$1<em>$2</em>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return s;
}

export default function QuizInstruction(props) {
  const { topic, changeTopic, course } = props;

  function onQuizSubmit({ id, title, type, selectedIndices, correctIndices, percentCorrect }) {
    console.log('quiz submit', { percentCorrect });
  }

  function handleQuizClick(event, quizRoot) {
    if (event.target.hasAttribute('data-plugin-masteryls-index')) {
      const id = quizRoot.getAttribute('data-plugin-masteryls-id') || undefined;
      const title = quizRoot.getAttribute('data-plugin-masteryls-title') || undefined;
      const type = quizRoot.getAttribute('data-plugin-masteryls-type') || undefined;

      // read selected & correct indices from DOM
      const inputs = Array.from(quizRoot.querySelectorAll('input[data-plugin-masteryls-index]'));
      const selected = [];
      const correct = [];
      inputs.forEach((inp) => {
        const idx = Number(inp.getAttribute('data-plugin-masteryls-index'));
        if (inp.checked) selected.push(idx);
        if (inp.getAttribute('data-plugin-masteryls-correct') === 'true') correct.push(idx);
      });
      selected.sort((a, b) => a - b);
      correct.sort((a, b) => a - b);

      // Calculate percent correct
      const total = correct.length;
      const correctSelections = selected.filter((idx) => correct.includes(idx)).length;
      const incorrectSelections = selected.filter((idx) => !correct.includes(idx)).length;
      const matched = Math.max(0, correctSelections - incorrectSelections);
      const percentCorrect = total === 0 ? 0 : Math.round((matched / total) * 100);

      onQuizSubmit?.({ id, title, type, selectedIndices: selected, correctIndices: correct, percentCorrect });

      // give visual feedback
      let ringClass = 'ring-yellow-400';
      if (percentCorrect === 100) ringClass = 'ring-green-500';
      else if (percentCorrect === 0) ringClass = 'ring-red-500';
      quizRoot.classList.add('ring-2', ringClass);
      setTimeout(() => quizRoot.classList.remove('ring-2', 'ring-yellow-400', 'ring-green-500', 'ring-red-500'), 600);
    }
  }

  return (
    <MarkdownInstruction
      topic={topic}
      changeTopic={changeTopic}
      course={course}
      languagePlugins={[
        {
          lang: 'masteryls',
          handler: handleQuizClick,
          processor: injectQuiz,
        },
      ]}
    />
  );
}
