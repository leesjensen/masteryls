import React from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import MasteryView from '../../views/masteryView/masteryView.jsx';
import LearnerMasteryView from '../../views/masteryView/learnerMasteryView.jsx';

// Renders the Mastery synthetic topic in the classroom content pane (like Schedule/Sections). An
// overseer with no learner selected sees the course roster; a drill-down (a learner id in the route)
// or a learner viewing their own progress sees the per-learner view. `startObserveSession` comes from
// the outlet context, which is in scope because the mastery route lives under the classroom.
export default function MasteryInstruction({ courseOps }) {
  const { courseId, learnerId } = useParams();
  const { startObserveSession } = useOutletContext();
  const isOverseer = Boolean(courseOps?.user?.canOverseeCourse?.(courseId));

  if (isOverseer && !learnerId) {
    return <MasteryView courseOps={courseOps} startObserveSession={startObserveSession} />;
  }
  return <LearnerMasteryView courseOps={courseOps} startObserveSession={startObserveSession} />;
}
