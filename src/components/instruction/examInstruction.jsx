import React from 'react';
import QuizInstruction from './quiz/quizInstruction';
import { getQuizProgress } from './quiz/quizProgressStore';

export default function ExamInstruction({ courseOps, topic, user, content = null, instructionState = 'learning' }) {
  const [loading, setLoading] = React.useState(true);
  const [examState, setExamState] = React.useState({ details: { state: 'notStarted' } });
  const quizIds = React.useRef([]);

  React.useEffect(() => {
    async function fetchExamState() {
      if (courseOps?.enrollment) {
        const state = await courseOps.getExamState();
        setExamState(state);
        setLoading(false);
      }
    }
    fetchExamState();
  }, [courseOps?.enrollment]);

  const updateState = async (state) => {
    const details = { state };
    if (state === 'completed') {
      details.results = { ai: calculateExamStats() };
    }

    setExamState({ details });
    courseOps.addProgress(null, null, 'exam', 0, details);
  };

  const quizStateReporter = (quizId) => {
    quizIds.current.push(quizId);
  };

  const calculateExamStats = () => {
    let totalAnsweredQuestions = 0;
    let totalGradedQuestions = 0;
    let totalPercentCorrect = 0;
    let totalQuestions = quizIds.current.length;

    quizIds.current.forEach((quizId) => {
      const quiz = getQuizProgress(quizId);
      if (quiz && quiz.feedback) {
        totalAnsweredQuestions++;
        if (quiz.percentCorrect !== undefined) {
          totalPercentCorrect += quiz.percentCorrect;
          totalGradedQuestions++;
        }
      }
    });

    const percentCorrect = totalGradedQuestions > 0 ? Math.round((totalPercentCorrect / totalGradedQuestions) * 100) / 100 : 0;

    return { totalQuestions, totalAnsweredQuestions, totalGradedQuestions, percentCorrect };
  };

  if (loading) {
    return <div />;
  } else if (!user) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">{topic.title}</h2>
        <p className="mb-6">You must be a registered user to take an exam.</p>
      </div>
    );
  }
  if (instructionState === 'preview') {
    return (
      <div className="p-6">
        <div className="bg-blue-50 border-1 border-blue-200 p-4 flex flex-col items-start">
          <div className="text-2xl font-bold text-blue-500">Preview</div>
        </div>
        <QuizInstruction courseOps={courseOps} topic={topic} user={user} content={content} instructionState={'preview'} />
      </div>
    );
  } else if (examState.details.state === 'notStarted') {
    return (
      <div className="p-6">
        <div className="bg-blue-50 border-1 border-blue-200 p-4 flex flex-col items-start">
          <div className="text-2xl font-bold text-blue-500">{topic.title}</div>
          <p className="my-4">{topic.description}</p>
          <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" onClick={() => updateState('inProgress')}>
            Start exam
          </button>
        </div>
      </div>
    );
  } else if (examState.details.state === 'completed') {
    return (
      <div className="p-6">
        <div className="bg-blue-50 border-1 border-blue-200 p-4 flex flex-col items-start">
          <div className="text-2xl font-bold text-blue-500">Submitted</div>
          <p className="my-4">
            The exam is now in <b>read-only</b> mode and has been graded by AI. This exam will be reviewed by a mentor who will provide your final score.
          </p>
          {examState.details.results.ai && (
            <ul className="text-start list-disc list-inside">
              <li className="text-sm text-blue-400 font-normal">
                {examState.details.results.ai.totalAnsweredQuestions}/{examState.details.results.ai.totalQuestions} questions submitted
              </li>
              <li className="text-sm text-blue-400 font-normal">
                <em>AI reviewed</em> {examState.details.results.ai.totalGradedQuestions} of the questions for a score of {examState.details.results.ai.percentCorrect.toFixed(2)}%
              </li>
            </ul>
          )}
        </div>

        <div className="relative pointer-events-none opacity-75 select-none">
          <QuizInstruction courseOps={courseOps} topic={topic} user={user} content={content} instructionState={'examReview'} />
        </div>
      </div>
    );
  } else {
    return (
      <div className="p-6">
        <div className="bg-amber-50 border-1 border-amber-200 p-4 flex flex-col items-start">
          <div className="text-2xl font-bold text-amber-500">{topic.title}</div>
          <p className="my-4">Carefully review your answers before submitting.</p>
          <button className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700" onClick={() => updateState('completed')}>
            Submit exam
          </button>
        </div>

        <QuizInstruction courseOps={courseOps} topic={topic} user={user} content={content} instructionState={'exam'} quizStateReporter={quizStateReporter} />
      </div>
    );
  }
}
