import React, { useRef } from 'react';
// import { useSwipeNavigation } from '../../hooks/useSwipeNavigation';
import VideoInstruction from './videoInstruction';
import QuizInstruction from './quiz/quizInstruction';
import useProgressTracking from '../../hooks/useProgressTracking';

export default function Instruction({ courseOps, topic, course, user, preview = null }) {
  const containerRef = useRef(null);

  // const containerRef = useSwipeNavigation(
  //   useCallback(() => courseOps.navigateToAdjacentTopic('next'), [course, topic]),
  //   useCallback(() => courseOps.navigateToAdjacentTopic('prev'), [course, topic])
  // );

  useProgressTracking({
    activityId: topic?.id,
    activityType: 'instructionView',
    onProgress: courseOps?.addProgress,
    enabled: !preview && !!topic?.path && !!courseOps?.addProgress,
    minDuration: 5,
    dependencies: [topic?.path],
  });

  const contentAvailable = topic && topic.path && (!topic.state || topic.state === 'stable');
  if (!contentAvailable) {
    return <div className="flex p-4 w-full select-none disabled bg-gray-200 text-gray-700">This topic content must be generated before it can be viewed.</div>;
  }

  let instructionComponent;
  switch (topic.type) {
    case 'video':
      instructionComponent = <VideoInstruction topic={topic} courseOps={courseOps} />;
      break;
    case 'exam':
      instructionComponent = <QuizInstruction courseOps={courseOps} topic={topic} user={user} preview={preview} />;
      break;
    default:
      instructionComponent = <QuizInstruction courseOps={courseOps} topic={topic} user={user} preview={preview} />;
      break;
  }

  return (
    <section ref={containerRef} className="flex-1 overflow-auto rounded-xs border border-gray-200">
      {instructionComponent}
    </section>
  );
}
