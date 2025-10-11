import React, { useCallback, useEffect, useRef } from 'react';
// import { useSwipeNavigation } from '../../hooks/useSwipeNavigation';
import VideoInstruction from './videoInstruction';
import QuizInstruction from './quiz/quizInstruction';

export default function Instruction({ courseOps, topic, course, user, preview = null }) {
  const startTimeRef = useRef(null);
  const containerRef = useRef(null);
  const totalTimeRef = useRef(0);
  const isVisibleRef = useRef(true);

  // const containerRef = useSwipeNavigation(
  //   useCallback(() => courseOps.navigateToAdjacentTopic('next'), [course, topic]),
  //   useCallback(() => courseOps.navigateToAdjacentTopic('prev'), [course, topic])
  // );

  // Track time when component mounts and when topic changes
  useEffect(() => {
    if (!preview) {
      startTimeRef.current = Date.now();
      totalTimeRef.current = 0;
      isVisibleRef.current = true;

      // Handle page visibility changes
      const handleVisibilityChange = () => {
        const now = Date.now();
        if (document.hidden) {
          // Page became hidden, accumulate time
          if (startTimeRef.current && isVisibleRef.current) {
            totalTimeRef.current += now - startTimeRef.current;
          }
          isVisibleRef.current = false;
        } else {
          // Page became visible, restart timer
          startTimeRef.current = now;
          isVisibleRef.current = true;
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      // Cleanup function to record progress when component unmounts or topic changes
      return async () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);

        if (topic && topic.path && courseOps.addProgress) {
          let totalDuration = totalTimeRef.current;

          // Add current session time if page is visible
          if (startTimeRef.current && isVisibleRef.current) {
            totalDuration += Date.now() - startTimeRef.current;
          }

          const duration = Math.round(totalDuration / 1000); // Duration in seconds

          if (duration >= 30) {
            await courseOps.addProgress(topic.id, 'instruction_view', duration);
          }
        }
      };
    }
  }, [topic?.path, courseOps]); // Re-run when topic changes

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
