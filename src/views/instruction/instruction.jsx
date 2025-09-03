import React, { useCallback } from 'react';
import { useSwipeNavigation } from '../../hooks/useSwipeNavigation';
import MarkdownInstruction from './markdownInstruction';
import VideoInstruction from './videoInstruction';
import QuizInstruction from './quiz/quizInstruction';

export default function Instruction({ topic, changeTopic, course, navigateToAdjacentTopic }) {
  const containerRef = useSwipeNavigation(
    useCallback(() => navigateToAdjacentTopic('next'), [course, topic]),
    useCallback(() => navigateToAdjacentTopic('prev'), [course, topic])
  );

  let instructionComponent;
  switch (topic.type) {
    case 'video':
      instructionComponent = <VideoInstruction topic={topic} />;
      break;
    case 'quiz':
      instructionComponent = <QuizInstruction topic={topic} changeTopic={changeTopic} course={course} />;
      break;
    default:
      instructionComponent = <MarkdownInstruction topic={topic} changeTopic={changeTopic} course={course} />;
      break;
  }

  return (
    <section ref={containerRef} className="flex-1 overflow-auto rounded-xs border border-gray-200">
      {instructionComponent}
    </section>
  );
}
