import React from 'react';
import inlineLiteMarkdown from './inlineLiteMarkdown';
import { useInteractionProgressStore } from './interactionProgressStore';

export default function MultipleChoiceInteraction({ quizId, quizType, body }) {
  const progress = useInteractionProgressStore(quizId) || {};

  const lines = body.split('\n');
  const firstChoiceIndex = lines.findIndex((l) => l.startsWith('- ['));

  const promptLines = firstChoiceIndex >= 0 ? lines.slice(0, firstChoiceIndex) : lines;
  const choiceLines = firstChoiceIndex >= 0 ? lines.slice(firstChoiceIndex) : [];

  const prompt = promptLines.join('\n');
  const choices = choiceLines
    .filter((l) => l.startsWith('- ['))
    .map((line) => {
      const correct = /^\-\s*\[\s*[xX]\s*\]/.test(line);
      const text = line.replace(/^\-\s*\[\s*[xX ]\s*\]\s*/, '').trim();
      return { text, correct };
    });

  const useRadioButtons = (quizType || '').toLowerCase() === 'multiple-choice';
  const selectedIndices = progress.selected;
  const [currentSelections, setCurrentSelections] = React.useState(new Set(selectedIndices || []));

  const handleSelectionChange = (index, checked) => {
    const newSelections = new Set(currentSelections);
    if (useRadioButtons) {
      newSelections.clear();
      if (checked) {
        newSelections.add(index);
      }
    } else {
      if (checked) {
        newSelections.add(index);
      } else {
        newSelections.delete(index);
      }
    }
    setCurrentSelections(newSelections);
  };

  return (
    <>
      <div className="mb-3 break-words whitespace-pre-line" data-plugin-masteryls-body>
        {inlineLiteMarkdown(prompt)}
      </div>
      <div>
        {choices.map((choice, i) => {
          const selected = selectedIndices && selectedIndices.includes(i);
          return (
            <div key={i} className="flex items-start gap-2">
              <label className="cursor-pointer">
                <input className="mt-1" type={useRadioButtons ? 'radio' : 'checkbox'} name={`quiz-${quizId}`} data-plugin-masteryls-index={i} defaultChecked={!!selected} onChange={(e) => handleSelectionChange(i, e.target.checked)} {...(choice.correct ? { 'data-plugin-masteryls-correct': 'true' } : {})} />
                <span className="p-2">{inlineLiteMarkdown(choice.text)}</span>
              </label>
            </div>
          );
        })}
        <button type="submit" className="mt-3 px-6 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 transition-colors duration-200" disabled={useRadioButtons && currentSelections.size === 0}>
          Submit
        </button>
      </div>
    </>
  );
}
