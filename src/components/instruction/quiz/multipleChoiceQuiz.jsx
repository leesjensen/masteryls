import React from 'react';
import inlineLiteMarkdown from './inlineLiteMarkdown';
import { useQuizFeedback } from './feedbackStore';

export default function MultipleChoiceQuiz({ quizId, quizType, itemsText }) {
  const progress = useQuizFeedback(quizId) || {};

  const lines = itemsText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('- ['));

  const choices = lines.map((line) => {
    const correct = /^\-\s*\[\s*[xX]\s*\]/.test(line);
    const text = line.replace(/^\-\s*\[\s*[xX ]\s*\]\s*/, '').trim();
    return { text, correct };
  });

  const useRadioButtons = (quizType || '').toLowerCase() === 'multiple-choice';
  const selectedIndices = progress.selected;

  return (
    <div>
      {choices.map((choice, i) => {
        const selected = selectedIndices && selectedIndices.includes(i);
        return (
          <div key={i} className="flex items-start gap-2">
            <label className="cursor-pointer">
              <input className="mt-1" type={useRadioButtons ? 'radio' : 'checkbox'} name={`quiz-${quizId}`} data-plugin-masteryls-index={i} defaultChecked={!!selected} {...(choice.correct ? { 'data-plugin-masteryls-correct': 'true' } : {})} />
              <span className="p-2">{inlineLiteMarkdown(choice.text)}</span>
            </label>
          </div>
        );
      })}
    </div>
  );
}
