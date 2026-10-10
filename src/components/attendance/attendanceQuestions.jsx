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

// Edit a single multiple-choice question before opening attendance.
export function AttendanceQuestionEditor({ question, onChange }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm text-gray-600">
        Question
        <input type="text" aria-label="Attendance question" value={question.prompt} onChange={(e) => onChange({ ...question, prompt: e.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm" />
      </label>
      <label className="block text-sm text-gray-600">
        Choices (one per line)
        <textarea aria-label="Attendance question choices" rows={4} value={question.choices.join('\n')} onChange={(e) => onChange({ ...question, choices: e.target.value.split('\n') })} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm" />
      </label>
    </div>
  );
}
