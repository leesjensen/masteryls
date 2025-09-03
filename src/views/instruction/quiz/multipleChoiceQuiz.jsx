import React from 'react';
import inlineLiteMarkdown from './inlineLiteMarkdown';

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
          <div key={i} className="flex items-start gap-2">
            <label className="cursor-pointer">
              <input className="mt-1" type={useRadioButtons ? 'radio' : 'checkbox'} name={`quiz-${meta.id}`} data-plugin-masteryls-index={i} {...(it.correct ? { 'data-plugin-masteryls-correct': 'true' } : {})} />
              <span className="p-2">{inlineLiteMarkdown(it.text)}</span>
            </label>
          </div>
        );
      })}
    </div>
  );
}
