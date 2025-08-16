import React, { useEffect, useState, useCallback } from 'react';
import { useSwipeNavigation } from './useSwipeNavigation';
import MarkdownInstruction from './markdownInstruction';
import VideoInstruction from './videoInstruction';

export default function Instruction({ topic, changeTopic, course, navigateToAdjacentTopic }) {
  const containerRef = useSwipeNavigation(
    useCallback(() => navigateToAdjacentTopic('next'), [course, topic]),
    useCallback(() => navigateToAdjacentTopic('prev'), [course, topic])
  );

  if (topic.type === 'video') {
    return (
      <section ref={containerRef} className="flex-1 overflow-auto my-2 rounded-xs border border-gray-200">
        <VideoInstruction topic={topic} />;
      </section>
    );
  }

  return (
    <section ref={containerRef} className="flex-1 overflow-auto my-2 rounded-xs border border-gray-200">
      <MarkdownInstruction topic={topic} changeTopic={changeTopic} course={course} />
    </section>
  );
}
