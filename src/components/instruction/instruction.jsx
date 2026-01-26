import React from 'react';
import VideoInstruction from './videoInstruction';
import ExamInstruction from './examInstruction';
import InteractionInstruction from './interaction/interactionInstruction';
import useProgressTracking from '../../hooks/useProgressTracking';
import { addInteractionProgress } from './interaction/interactionProgressStore';

export default function Instruction({ courseOps, learningSession, user, content = null, instructionState = 'learning' }) {
  const [loadingProgress, setLoadingProgress] = React.useState(true);

  React.useEffect(() => {
    courseOps.getTopicProgress(['quizSubmit']).then((progress) => {
      Object.entries(progress).forEach(([key, value]) => {
        addInteractionProgress(key, value.details || {});
      });
      setLoadingProgress(false);
    });
  }, [learningSession]);

  useProgressTracking({
    progressType: `${learningSession.topic.type || 'instruction'}View`,
    onProgress: courseOps?.addProgress,
    enabled: !content && !!learningSession.topic?.path && !!courseOps?.addProgress,
    minDuration: 10,
    dependencies: [learningSession.topic?.path],
  });

  if (loadingProgress) {
    return null;
  }

  const contentAvailable = learningSession.topic && learningSession.topic.path && (!learningSession.topic.state || learningSession.topic.state === 'published');
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
      instructionComponent = <InteractionInstruction courseOps={courseOps} learningSession={learningSession} user={user} content={content} instructionState={instructionState} />;
      break;
  }

  return instructionComponent;
}
