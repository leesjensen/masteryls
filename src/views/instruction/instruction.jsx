import React, { useCallback } from 'react';
import { useSwipeNavigation } from '../../hooks/useSwipeNavigation';
import MarkdownInstruction from './markdownInstruction';
import VideoInstruction from './videoInstruction';
import QuizInstruction from './quiz/quizInstruction';

export default function Instruction({ courseOps, topic, course }) {
  const containerRef = useSwipeNavigation(
    useCallback(() => courseOps.navigateToAdjacentTopic('next'), [course, topic]),
    useCallback(() => courseOps.navigateToAdjacentTopic('prev'), [course, topic])
  );

  let instructionComponent;
  switch (topic.type) {
    case 'video':
      instructionComponent = <VideoInstruction topic={topic} />;
      break;
    case 'quiz':
      instructionComponent = <QuizInstruction courseOps={courseOps} topic={topic} course={course} />;
      break;
    default:
      instructionComponent = <MarkdownInstruction courseOps={courseOps} topic={topic} course={course} />;
      break;
  }

  return (
    <section ref={containerRef} className="flex-1 overflow-auto rounded-xs border border-gray-200">
      {instructionComponent}
    </section>
  );
}
