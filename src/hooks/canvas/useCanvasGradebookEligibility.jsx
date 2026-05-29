import React from 'react';

export function useCanvasGradebookEligibility({ courseOps, learningSession, user, isCourseLinkedToGradebook }) {
  const [canSubmitToCanvasGradebook, setCanSubmitToCanvasGradebook] = React.useState(false);

  React.useEffect(() => {
    let active = true;

    async function loadCanvasEligibility() {
      const isProjectTopic = learningSession?.topic?.type === 'project';
      if (!isCourseLinkedToGradebook || !isProjectTopic || typeof courseOps?.isLearnerInCanvasCourse !== 'function') {
        if (active) {
          setCanSubmitToCanvasGradebook(false);
        }
        return;
      }

      const eligible = await courseOps.isLearnerInCanvasCourse(user, learningSession?.course);
      if (active) {
        setCanSubmitToCanvasGradebook(eligible === true);
      }
    }

    loadCanvasEligibility();

    return () => {
      active = false;
    };
  }, [courseOps, isCourseLinkedToGradebook, learningSession?.course, learningSession?.topic?.type, user]);

  return canSubmitToCanvasGradebook;
}
