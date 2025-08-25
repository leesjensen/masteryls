import React from 'react';
import inlineLiteMarkdown from './inlineLitMarkdown';

export default function MultipleChoiceQuiz({ meta, itemsText }) {
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

  return (
    <div>
      {items.map((it, i) => {
        return (
          <div class="flex items-start gap-2">
            <label class="cursor-pointer">
              <input type={useRadioButtons ? 'radio' : 'checkbox'} name={`quiz-${meta.id}`} data-plugin-masteryls-index={i} {...(it.correct ? { 'data-plugin-masteryls-correct': 'true' } : {})} class="mt-1" />
              {inlineLiteMarkdown(it.text)}
            </label>
          </div>
        );
      })}
    </div>
  );
}
