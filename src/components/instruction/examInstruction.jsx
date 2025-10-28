import React from 'react';
import QuizInstruction from './quiz/quizInstruction';

export default function ExamInstruction({ courseOps, topic, user, preview = null }) {
  const [loading, setLoading] = React.useState(true);
  const [examState, setExamState] = React.useState('notStarted'); // 'notStarted', 'inProgress', 'completed'

  React.useEffect(() => {
    async function fetchExamState() {
      console.log('Fetching exam state for user:', user?.id);
      if (courseOps?.enrollment) {
        const state = await courseOps.getExamState();
        setExamState(state);
        setLoading(false);
      }
    }
    fetchExamState();
  }, [courseOps?.enrollment]);

  const updateState = async (state) => {
    setExamState(state);
    courseOps.addProgress(null, null, 'exam', 0, { state });
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
  } else if (examState === 'notStarted') {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">{topic.title}</h2>
        <p className="mb-6">You are about to start the exam.</p>
        <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" onClick={() => updateState('inProgress')}>
          Start exam
        </button>
      </div>
    );
  } else if (examState === 'completed') {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">{topic.title}</h2>
        <p className="mb-6">You have submitted this exam.</p>
      </div>
    );
  } else {
    return (
      <div className="p-6">
        <button className="mt-3 px-6 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200" onClick={() => updateState('completed')}>
          Submit exam
        </button>
        <QuizInstruction courseOps={courseOps} topic={topic} user={user} preview={preview} exam={true} />
      </div>
    );
  }
}
