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
      meta.type = meta.type.toLowerCase();
    } catch {}
    itemsText = raw.slice(jsonMatch.index + jsonMatch[0].length).trim();
  }
  let controlHtml = generateControlHtml(meta, itemsText);
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
          ${controlHtml}
        </div>
      </fieldset>
    </div>
  `;
}

function generateControlHtml(meta, itemsText) {
  let controlHtml = <div></div>;
  if (meta.type && (meta.type === 'multiple-choice' || meta.type === 'multiple-select')) {
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

    controlHtml = items
      .map((it, i) => {
        return `<div class="flex items-start gap-2">
                <label class="cursor-pointer">
                  <input type="${useRadioButtons ? 'radio' : 'checkbox'}"
                    name="quiz-${meta.id}"
                    data-plugin-masteryls-index="${i}"
                    ${it.correct ? 'data-plugin-masteryls-correct="true"' : ''}
                    class="mt-1" />
                  ${inlineLiteMarkdown(it.text)}
                </label>
              </div>`;
      })
      .join('');
  } else if (meta.type === 'essay') {
    controlHtml = `<textarea name="quiz-${meta.id}" class="w-full h-32 p-3 border border-gray-300 rounded-lg resize-none transition-colors duration-200 placeholder-gray-400" placeholder="Enter your answer here..."></textarea>`;
  } else if (meta.type === 'file-submission') {
    controlHtml = `
      <div id="drop-zone-${meta.id}" class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors duration-200">
        <input type="file" name="quiz-${meta.id}" id="file-input-${meta.id}" multiple hidden />
        <label for="file-input-${meta.id}" class="cursor-pointer">
          <div class="text-gray-500">
            <svg class="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
              <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <p class="mt-2 text-sm">
              <span class="font-medium text-blue-600 hover:text-blue-500">Click to upload</span> or drag and drop
            </p>
          </div>
        </label>
        <div class="file-names mt-3">
          <p class="text-sm font-medium text-gray-700 mb-1">Selected files:</p>
          <ul class="text-sm text-gray-600"></ul>
        </div>
      </div>
      <script type="module">
        const dropZone = document.getElementById('drop-zone-${meta.id}');
        const fileInput = document.getElementById('file-input-${meta.id}');
        const fileNamesDiv = dropZone.querySelector('.file-names');
        const fileNamesList = fileNamesDiv.querySelector('ul');

console.log("loading script", { dropZone, fileInput, fileNamesDiv });

        dropZone.addEventListener('dragover', (e) => {
          e.preventDefault();
          dropZone.classList.add('border-blue-400', 'bg-blue-50');
        });

        dropZone.addEventListener('dragleave', () => {
          dropZone.classList.remove('border-blue-400', 'bg-blue-50');
        });

        dropZone.addEventListener('drop', (e) => {
          e.preventDefault();
          fileInput.files = e.dataTransfer.files;
          updateFileNames();
          console.log("updateFileNames", { fileInput });
        });

        fileInput.addEventListener('change', updateFileNames);

        function updateFileNames() {
          if (fileInput.files.length > 0) {
            fileNamesList.innerHTML = Array.from(fileInput.files)
              .map(f => "<li>" + f.name + "</li>").join('');
            fileNamesDiv.classList.remove('hidden');
          } else {
            fileNamesDiv.classList.add('hidden');
          }
        }
      </script>`;
  }

  return controlHtml;
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

    console.log({ selected, correct });

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
