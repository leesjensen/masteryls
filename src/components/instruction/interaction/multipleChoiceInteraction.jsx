import React from 'react';
import inlineLiteMarkdown, { renderLiteMarkdownBlocks } from './inlineLiteMarkdown';
import { useInteractionProgressStore } from './interactionProgressStore';
import { InteractionSubmitRow } from './InteractionEvaluationStatus.jsx';

export default function MultipleChoiceInteraction({ id, quizType, body }) {
  const progress = useInteractionProgressStore(id) || {};

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
  const [currentSelections, setCurrentSelections] = React.useState(() => new Set(selectedIndices || []));

  // The saved selection can arrive after mount (the progress store is populated async when a
  // topic loads). Keep the controlled inputs in sync so a previously-submitted selection renders
  // even when it lands late. Keyed on the serialized ids so it only re-syncs when the saved set
  // actually changes - and since the store only holds `selected` for already-submitted
  // interactions, this never clobbers a user's in-progress (unsubmitted) clicks.
  const selectedKey = Array.isArray(selectedIndices) ? selectedIndices.join(',') : '';
  React.useEffect(() => {
    setCurrentSelections(new Set(selectedIndices || []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);

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
        {renderLiteMarkdownBlocks(prompt)}
      </div>
      <div>
        {choices.map((choice, i) => {
          return (
            <div key={i} className="flex items-start gap-2">
              <label className="cursor-pointer">
                <input className="mt-1" type={useRadioButtons ? 'radio' : 'checkbox'} name={`quiz-${id}`} data-plugin-masteryls-index={i} checked={currentSelections.has(i)} onChange={(e) => handleSelectionChange(i, e.target.checked)} {...(choice.correct ? { 'data-plugin-masteryls-correct': 'true' } : {})} />
                <span className="p-2">{inlineLiteMarkdown(choice.text)}</span>
              </label>
            </div>
          );
        })}
        <InteractionSubmitRow id={id} details={progress} disabled={useRadioButtons && currentSelections.size === 0} />
      </div>
    </>
  );
}
