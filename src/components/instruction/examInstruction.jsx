import React from 'react';
import QuizInstruction from './quiz/quizInstruction';

export default function ExamInstruction({ courseOps, topic, user, initialProgress = {}, content = null }) {
  const [loading, setLoading] = React.useState(true);
  const [examState, setExamState] = React.useState({ details: { state: 'notStarted' } });
  const [examStats, setExamStats] = React.useState({ count: 0, answered: 0, percentCorrect: 0 });

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
    setExamState({ details: { state } });
    courseOps.addProgress(null, null, 'exam', 0, { state });
  };

  React.useEffect(() => {
    if (initialProgress) {
      let sum = 0;
      let count = Object.keys(initialProgress).length;
      let answered = 0;
      Object.values(initialProgress).forEach((item) => {
        if (item.details?.percentCorrect !== undefined) {
          sum += item.details?.percentCorrect || 0;
          answered++;
        }
      });
      setExamStats({ count, answered, percentCorrect: count > 0 ? sum / count : 0 });
    }
  }, [initialProgress]);

  if (loading) {
    return <div />;
  } else if (!user) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">{topic.title}</h2>
        <p className="mb-6">You must be a registered user to take an exam.</p>
      </div>
    );
  } else if (examState.details.state === 'notStarted') {
    return (
      <div className="p-6">
        <h2 className="text-2xl w-full bg-blue-50 font-bold border-1 border-blue-200 py-4 mb-4 text-center text-blue-500">{topic.title}</h2>
        <p className="mb-6">{topic.description}</p>
        <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" onClick={() => updateState('inProgress')}>
          Start exam
        </button>
      </div>
    );
  } else if (examState.details.state === 'completed') {
    return (
      <div className="p-6">
        <h2 className="text-2xl w-full bg-blue-50 font-bold border-1 border-blue-200 py-4 mb-4 text-center text-blue-500">
          Submitted
          <div className="mb-4 text-lg pt-2 text-blue-400 font-normal text-center">
            {examStats.answered} out of {examStats.count} questions answered with an average score of {examStats.percentCorrect.toFixed(2)}%.
          </div>
        </h2>

        <div className="relative pointer-events-none opacity-75">
          <QuizInstruction courseOps={courseOps} topic={topic} user={user} initialProgress={initialProgress} content={content} instructionState={'examReview'} />
        </div>
      </div>
    );
  } else {
    return (
      <div className="p-6">
        <h2 className="text-2xl w-full bg-amber-50 font-bold border-1 border-amber-200 py-4 mb-4 text-center text-amber-500">In progress</h2>
        <button className="mt-3 px-6 py-1 bg-amber-400 text-white rounded-lg hover:bg-amber-700 transition-colors duration-200" onClick={() => updateState('completed')}>
          Submit exam
        </button>
        <QuizInstruction courseOps={courseOps} topic={topic} user={user} content={content} initialProgress={initialProgress} instructionState={'exam'} />
      </div>
    );
  }
}
