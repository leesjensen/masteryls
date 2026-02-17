import React, { useState, useEffect } from 'react';
import inlineLiteMarkdown from './inlineLiteMarkdown';
import { useInteractionProgressStore, updateInteractionProgress } from './interactionProgressStore';

export default function SurveyInteraction({ id, body, multipleSelect, courseOps, onGraded }) {
  const progress = useInteractionProgressStore(id) || {};
  const [surveyResults, setSurveyResults] = useState(null);
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

  const selectedIndices = progress.selected;
  const useRadioButtons = (multipleSelect || '').toLowerCase() !== 'true';
  const [currentSelections, setCurrentSelections] = useState(new Set(selectedIndices || []));

  function generateResults() {
    courseOps.getSurveySummary(id).then((summary) => {
      const counts = Object.values(summary.votes);
      const totalVotes = counts.reduce((sum, val) => sum + val, 0);

      setSurveyResults(
        <div className="mt-4 p-4 border rounded bg-blue-50 border-blue-700 max-w-[500px]">
          <div className="space-y-4">
            {choices.map((choice, i) => {
              const count = summary.votes[i] || 0;
              const percentageOfTotal = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
              const barWidth = percentageOfTotal;

              return (
                <div key={i} className="text-sm">
                  <div className="flex justify-between mb-1 items-end">
                    <span className="font-medium text-gray-700 flex-1 mr-4">{inlineLiteMarkdown(choice.text)}</span>
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {count} votes ({percentageOfTotal}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div className="bg-amber-400 h-full transition-all duration-700 ease-out" style={{ width: `${barWidth}%` }} />
                  </div>
                </div>
              );
            })}
            <div className="mt-4 pt-2 border-t text-right text-xs text-gray-400 italic">Total respondents: {summary.voters}</div>
          </div>
          <button className="mb-4 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700" onClick={() => generateResults()}>
            Refresh
          </button>
        </div>,
      );
    });
  }

  useEffect(() => {
    if (courseOps.user?.isRoot()) {
      generateResults();
    }
  }, []);

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

    setIsSubmitting(true);
    onGraded?.('pending');

    try {
      const details = { type: 'survey', selected };
      updateInteractionProgress(id, details);
      await courseOps.addProgress(null, id, 'quizSubmit', 0, details);
      onGraded?.(-1);

      if (courseOps.user?.isRoot()) {
        setTimeout(() => generateResults(), 1000);
      }
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
        {surveyResults}
      </div>
    </>
  );
}
