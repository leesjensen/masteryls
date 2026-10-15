import React from 'react';

// Answer the questions attached to an attendance session. answers: { [questionId]: answer }
export function AttendanceQuestions({ questions, answers, onChange }) {
  return (
    <div className="space-y-3">
      {questions.map((question) => (
        <fieldset key={question.id}>
          <legend className="text-sm font-medium text-gray-700 mb-1">{question.prompt}</legend>
          <div className="flex flex-wrap gap-3">
            {(question.choices || []).map((choice) => (
              <label key={choice} className="flex items-center gap-1 text-sm text-gray-700 cursor-pointer">
                <input type="radio" name={`attendance-${question.id}`} value={choice} checked={answers[question.id] === choice} onChange={() => onChange({ ...answers, [question.id]: choice })} />
                {choice}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
