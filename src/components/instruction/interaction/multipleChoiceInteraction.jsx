import React, { useState } from 'react';
import inlineLiteMarkdown from './inlineLiteMarkdown';
import { useInteractionProgressStore, updateInteractionProgress } from './interactionProgressStore';
import InteractionFeedback from './interactionFeedback';

export default function MultipleChoiceInteraction({ id, quizType, body, title, courseOps, instructionState, onGraded }) {
  const progress = useInteractionProgressStore(id) || {};
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showExplain, setShowExplain] = useState(false);

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

  /**
   * Handles user selection/deselection of answer choices.
   * For multiple-choice (radio), clears previous selections and allows only one.
   * For multiple-select (checkbox), allows toggling multiple choices.
   * @param {number} index - The index of the choice being changed
   * @param {boolean} checked - Whether the choice is being checked or unchecked
   */
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

  /**
   * Calculates the grading details for the current selection.
   * Compares selected answers against correct answers and computes a percentage score.
   * Scoring penalizes incorrect selections: (correct_selections - incorrect_selections) / total_correct_answers.
   * @returns {Object|null} Object containing type, selected indices, correct indices, and percentCorrect, or null if nothing selected
   */
  const getFeedbackDetails = () => {
    const selected = Array.from(currentSelections).sort((a, b) => a - b);
    const correct = choices.map((c, i) => (c.correct ? i : -1)).filter((i) => i >= 0);

    if (selected.length === 0) return null;

    // Calculate percent correct
    const total = correct.length;
    const correctSelections = selected.filter((idx) => correct.includes(idx)).length;
    const incorrectSelections = selected.filter((idx) => !correct.includes(idx)).length;
    const matched = Math.max(0, correctSelections - incorrectSelections);
    const percentCorrect = total === 0 ? 0 : Math.round((matched / total) * 100);

    return { type: quizType, selected, correct, percentCorrect };
  };

  /**
   * Fetches AI-generated feedback for the user's answer.
   * Sends the question, choices, user's answers, and correct answers to the backend.
   * If the API call fails, shows the "Explain" button so users can retry.
   * @param {Object} details - The grading details (selected, correct, percentCorrect) -- This should be the same object returned from `getFeedbackDetails`
   * @returns {Promise<string>} The feedback text from the AI or a fallback message
   */
  const getFeedback = async (details) => {
    const dataForAIQuery = {
      title,
      type: quizType,
      question: body,
      choices: choices.map((choice) => '\n   -' + choice.text).join(''),
      learnerAnswers: details.selected.map((i) => choices[i].text),
      correctAnswers: details.correct.map((i) => choices[i].text),
      percentCorrect: details.percentCorrect,
    };
    try {
      setShowExplain(false);
      return await courseOps.getChoiceInteractionFeedback(dataForAIQuery);
    } catch {
      // Something went wrong. The user can try manually requesting feedback.
      setShowExplain(true);
      return "Sorry, that's not quite right.";
    }
  };

  /**
   * Handles the submission of the user's answer.
   * Calculates the grade, fetches feedback (for incorrect answers), updates progress storage,
   * and notifies the parent component via onGraded callback for visual feedback.
   * For correct answers (100%), shows the "Explain" button to allow users to request additional explanation.
   */
  const handleSubmit = async () => {
    const details = getFeedbackDetails();

    if (!details) return;

    setIsSubmitting(true);
    onGraded?.('pending');

    try {
      if (details.percentCorrect < 100) {
        details.feedback = await getFeedback(details);
      } else {
        details.feedback = 'Correct!';
        setShowExplain(true);
      }
      updateInteractionProgress(id, details);
      await courseOps.addProgress(null, id, 'quizSubmit', 0, details);
      onGraded?.(details.percentCorrect);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handles the "Explain" button click.
   * Fetches detailed AI feedback/explanation for the user's answer and updates the stored progress.
   * The "Explain" button is hidden after successfully retrieving the explanation.
   */
  const handleExplain = async () => {
    setIsSubmitting(true);
    const details = getFeedbackDetails();
    console.log('details', details);
    try {
      details.feedback = await getFeedback(details);
      setShowExplain(false);
      updateInteractionProgress(id, details);
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
        {showExplain && (
          <button onClick={handleExplain} type="button" className="ml-4 mt-3 px-6 py-1 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:bg-gray-600 transition-colors duration-200" disabled={isSubmitting}>
            Explain
          </button>
        )}
      </div>
      {instructionState !== 'exam' && <InteractionFeedback quizId={id} courseOps={courseOps} instructionState={instructionState} />}
    </>
  );
}
