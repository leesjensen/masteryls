import React, { useState } from 'react';
import inlineLiteMarkdown from './inlineLiteMarkdown';
import { useInteractionProgressStore, updateInteractionProgress } from './interactionProgressStore';
import InteractionFeedback from './interactionFeedback';

export default function MultipleChoiceInteraction({ id, quizType, body, title, courseOps, instructionState, onGraded }) {
  const progress = useInteractionProgressStore(id) || {};
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  const [currentSelections, setCurrentSelections] = useState(new Set(selectedIndices || []));

  const handleSelectionChange = (index, checked) => {
    const newSelections = new Set(currentSelections);
    if (useRadioButtons) {
      newSelections.clear();
      if (checked) newSelections.add(index);
    } else {
      if (checked) newSelections.add(index);
      else newSelections.delete(index);
    }
    setCurrentSelections(newSelections);
  };

  const handleSubmit = async () => {
    const selected = Array.from(currentSelections).sort((a, b) => a - b);
    const correct = choices.map((c, i) => (c.correct ? i : -1)).filter((i) => i >= 0);
    const choiceTexts = choices.map((c) => c.text);

    if (selected.length === 0) return;

    setIsSubmitting(true);
    onGraded?.('pending');

    try {
      // Calculate percent correct
      const total = correct.length;
      const correctSelections = selected.filter((idx) => correct.includes(idx)).length;
      const incorrectSelections = selected.filter((idx) => !correct.includes(idx)).length;
      const matched = Math.max(0, correctSelections - incorrectSelections);
      const percentCorrect = total === 0 ? 0 : Math.round((matched / total) * 100);

      let feedback = '';
      let feedbackRequested = false;

      if (percentCorrect < 100) {
        try {
          const data = {
            title,
            type: quizType,
            question: body,
            choices: choiceTexts.map((choice) => '\n   -' + choice).join(''),
            learnerAnswers: selected.map((i) => choiceTexts[i]),
            correctAnswers: correct.map((i) => choiceTexts[i]),
            percentCorrect,
          };
          feedback = await courseOps.getChoiceInteractionFeedback(data);
          feedbackRequested = true;
        } catch {
          feedback = "That's not quite right. Click 'Get Explanation' below to understand what went wrong.";
        }
      } else {
        feedback = 'Correct!';
      }

      const details = { type: quizType, selected, correct, percentCorrect, feedback, feedbackRequested, title, body, choices: choiceTexts };
      updateInteractionProgress(id, details);
      await courseOps.addProgress(null, id, 'quizSubmit', 0, details);
      onGraded?.(percentCorrect);
    } finally {
      setIsSubmitting(false);
    }
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
                <input className="mt-1" type={useRadioButtons ? 'radio' : 'checkbox'} name={`quiz-${id}`} defaultChecked={!!selected} onChange={(e) => handleSelectionChange(i, e.target.checked)} />
                <span className="p-2">{inlineLiteMarkdown(choice.text)}</span>
              </label>
            </div>
          );
        })}
        <button onClick={handleSubmit} type="button" className="mt-3 px-6 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 transition-colors duration-200" disabled={(useRadioButtons && currentSelections.size === 0) || isSubmitting}>
          Submit
        </button>
      </div>
      {instructionState !== 'exam' && <InteractionFeedback quizId={id} courseOps={courseOps} instructionState={instructionState} />}
    </>
  );
}
