import React, { useRef } from 'react';
import VideoInstruction from './videoInstruction';
import ExamInstruction from './examInstruction';
import QuizInstruction from './quiz/quizInstruction';
import useProgressTracking from '../../hooks/useProgressTracking';
import { addQuizProgress } from './quiz/quizProgressStore';

export default function Instruction({ courseOps, learningSession, user, content = null, instructionState = 'learning' }) {
  const [loadingProgress, setLoadingProgress] = React.useState(true);

  React.useEffect(() => {
    async function fetchExamState() {
      courseOps.getQuizProgress().then((progress) => {
        Object.entries(progress).forEach(([key, value]) => {
          addQuizProgress(key, value.details || {});
        });
        setLoadingProgress(false);
      });
    }
    fetchExamState();
  }, [learningSession]);

  useProgressTracking({
    activityId: learningSession.topic?.id,
    activityType: 'instructionView',
    onProgress: courseOps?.addProgress,
    enabled: !content && !!learningSession.topic?.path && !!courseOps?.addProgress,
    minDuration: 5,
    dependencies: [learningSession.topic?.path],
  });

  if (loadingProgress) {
    return null;
  }

  const contentAvailable = learningSession.topic && learningSession.topic.path && (!learningSession.topic.state || learningSession.topic.state === 'stable');
  if (!contentAvailable) {
    return null;
  }

  let instructionComponent;
  switch (learningSession.topic.type) {
    case 'video':
      instructionComponent = <VideoInstruction learningSession={learningSession} courseOps={courseOps} />;
      break;
    case 'exam':
      instructionComponent = <ExamInstruction courseOps={courseOps} learningSession={learningSession} user={user} content={content} instructionState={instructionState} />;
      break;
    default:
      instructionComponent = <QuizInstruction courseOps={courseOps} learningSession={learningSession} user={user} content={content} instructionState={instructionState} />;
      break;
  }

  return instructionComponent;
}
