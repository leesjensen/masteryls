import React from 'react';
import QuizInstruction from './quiz/quizInstruction';

export default function ExamInstruction({ courseOps, topic, user, content = null }) {
  const [loading, setLoading] = React.useState(true);
  const [examState, setExamState] = React.useState({ details: { state: 'notStarted' } });
  const [initialProgress, setInitialProgress] = React.useState({});

  React.useEffect(() => {
    async function fetchExamState() {
      if (courseOps?.enrollment) {
        const state = await courseOps.getExamState();
        setExamState(state);
        setInitialProgress(await loadProgress());
        setLoading(false);
      }
    }
    fetchExamState();
  }, [courseOps?.enrollment]);

  async function loadProgress() {
    const progressItems = await courseOps.getProgress({ topicId: topic.id, enrollmentId: courseOps.enrollment.id, type: 'quizSubmit' });
    return progressItems.reduce((acc, item) => {
      const activityId = item.activityId;
      if (!acc[activityId] || new Date(item.creationDate) > new Date(acc[activityId].creationDate)) {
        acc[activityId] = item;
      }
      return acc;
    }, {});
  }

  const updateState = async (state) => {
    setExamState({ details: { state } });
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
  } else if (examState.details.state === 'notStarted') {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">{topic.title}</h2>
        <p className="mb-6">{topic.description}</p>
        <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" onClick={() => updateState('inProgress')}>
          Start exam
        </button>
      </div>
    );
  } else if (examState.details.state === 'completed') {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4 text-center text-amber-400">Submitted</h2>
        <div className="relative pointer-events-none opacity-50">
          <QuizInstruction courseOps={courseOps} topic={topic} user={user} content={content} instructionState={'exam'} />
        </div>
      </div>
    );
  } else {
    return (
      <div className="p-6">
        {examState.details.state === 'completed' && <h2 className="text-2xl font-bold mb-4">{topic.title} - Submitted</h2>}
        <button className="mt-3 px-6 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200" onClick={() => updateState('completed')}>
          Submit exam
        </button>
        <QuizInstruction courseOps={courseOps} topic={topic} user={user} initialProgress={initialProgress} content={content} instructionState={'exam'} />
      </div>
    );
  }
}
