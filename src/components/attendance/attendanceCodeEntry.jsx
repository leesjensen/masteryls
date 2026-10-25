import React from 'react';
import { AttendanceQuestions } from './attendanceQuestions.jsx';
import { allQuestionsAnswered } from './attendanceUtils.js';

// Learner check-in. Submits the code shown in class. If the session has questions, the server
// returns them without recording anything, and the learner answers and resubmits.
export default function AttendanceCodeEntry({ courseOps, courseId, sectionName, onRecorded }) {
  const [code, setCode] = React.useState('');
  const [questions, setQuestions] = React.useState(null);
  const [answers, setAnswers] = React.useState({});
  const [submitting, setSubmitting] = React.useState(false);
  const [message, setMessage] = React.useState(null);

  function reset() {
    setCode('');
    setQuestions(null);
    setAnswers({});
  }

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const result = await courseOps.recordAttendance(courseId, code, questions ? answers : null);
      if (result?.status === 'questions') {
        setQuestions(result.questions || []);
      } else {
        reset();
        setMessage({
          type: 'success',
          text: result?.status === 'alreadyRecorded' ? 'Your attendance was already recorded for this class.' : 'Your attendance has been recorded.',
        });
        onRecorded?.(result);
      }
    } catch (ex) {
      setQuestions(null);
      setAnswers({});
      setMessage({
        type: 'error',
        text: ex.message || 'Unable to record attendance.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  const validCode = /^\d{4}$/.test(code);
  const canSubmit = validCode && !submitting && (!questions || allQuestionsAnswered(questions, answers));

  return (
    <form onSubmit={submit} className="rounded-md border border-gray-200 bg-white p-4 space-y-3">
      <div className="text-base font-semibold text-gray-800">Check in to class</div>
      <p className="text-sm font-medium text-gray-700">Section: {sectionName}</p>
      <p className="text-sm text-gray-600">Enter the 4 digit attendance code shown in class.</p>
      <input type="text" inputMode="numeric" autoComplete="off" maxLength={4} aria-label="Attendance code" placeholder="0000" value={code} disabled={!!questions} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))} className="w-32 rounded-md border border-gray-300 px-3 py-2 text-center text-2xl tracking-[0.4em] font-mono disabled:bg-gray-100" />
      {questions && questions.length > 0 && <AttendanceQuestions questions={questions} answers={answers} onChange={setAnswers} />}
      <div className="flex items-center gap-2">
        <button type="submit" disabled={!canSubmit} className="px-4 py-2 rounded-md text-white font-semibold text-sm bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 disabled:cursor-not-allowed">
          {submitting ? 'Submitting...' : 'Submit'}
        </button>
        {questions && (
          <button type="button" onClick={reset} className="px-4 py-2 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm">
            Cancel
          </button>
        )}
      </div>
      {message && <div className={`text-sm ${message.type === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>{message.text}</div>}
    </form>
  );
}
