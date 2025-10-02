import React, { useCallback } from 'react';
import { useSwipeNavigation } from '../../hooks/useSwipeNavigation';
import VideoInstruction from './videoInstruction';
import QuizInstruction from './quiz/quizInstruction';

export default function Instruction({ courseOps, topic, course, user, preview = null }) {
  const containerRef = useSwipeNavigation(
    useCallback(() => courseOps.navigateToAdjacentTopic('next'), [course, topic]),
    useCallback(() => courseOps.navigateToAdjacentTopic('prev'), [course, topic])
  );

  const contentAvailable = topic && topic.path && (!topic.state || topic.state === 'stable');
  if (!contentAvailable) {
    return <div className="flex p-4 w-full select-none disabled bg-gray-200 text-gray-700">This topic content must be generated before it can be viewed.</div>;
  }

  let instructionComponent;
  switch (topic.type) {
    case 'video':
      instructionComponent = <VideoInstruction topic={topic} />;
      break;
    case 'quiz':
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
