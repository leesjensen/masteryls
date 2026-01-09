import React from 'react';
import inlineLiteMarkdown from './inlineLiteMarkdown';
import { useQuizProgressStore } from './quizProgressStore';

export default function SurveyQuiz({ quizId, itemsText, multipleSelect, courseOps }) {
  const progress = useQuizProgressStore(quizId) || {};
  const [surveyResults, setSurveyResults] = React.useState(null);

  function generateResults() {
    courseOps.getSurveySummary(quizId).then((summary) => {
      const counts = Object.values(summary.votes);
      const totalVotes = counts.reduce((sum, val) => sum + val, 0);

      setSurveyResults(
        <div className="mt-4 p-4 border rounded bg-blue-50 border-blue-700 max-w-[500px]">
          <div className="space-y-4">
            {choices.map((choice, i) => {
              // summary keys are strings like "2", so we access via summary[i]
              const count = summary.votes[i] || 0;
              const percentageOfTotal = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
              const barWidth = percentageOfTotal; //maxVotes > 0 ? (count / maxVotes) * 100 : 0;

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
        </div>
      );
    });
  }

  React.useEffect(() => {
    if (courseOps.user.isRoot()) {
      generateResults();
    }
  }, []);

  const lines = itemsText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('- ['));

  const choices = lines.map((line) => {
    const correct = /^\-\s*\[\s*[xX]\s*\]/.test(line);
    const text = line.replace(/^\-\s*\[\s*[xX ]\s*\]\s*/, '').trim();
    return { text, correct };
  });

  const selectedIndices = progress.selected;
  const useRadioButtons = (multipleSelect || '').toLowerCase() !== 'true';

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
      {surveyResults}
    </div>
  );
}
