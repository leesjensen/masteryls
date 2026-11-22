import React from 'react';
import EmbeddedInstruction from './embeddedInstruction';
import ExamInstruction from './examInstruction';
import InteractionInstruction from './interaction/interactionInstruction';
import ScheduleInstruction from './scheduleInstruction';
import AttendanceInstruction from '../attendance/attendanceInstruction';
import SectionsAdminView from '../../views/sectionsAdmin/sectionsAdminView';
import MasteryInstruction from './masteryInstruction';
import DraInstruction from './dra/draInstruction';
import InterviewInstruction from './interview/interviewInstruction';
import useProgressTracking from '../../hooks/useProgressTracking';
import { replaceAllInteractionProgress } from './interaction/interactionProgressStore';
import useOnlineStatus from '../../hooks/useOnlineStatus.js';
import OfflineNotice from '../OfflineNotice.jsx';

function OfflineUnavailable({ title }) {
  return (
    <section className="mx-auto w-full max-w-4xl p-4" aria-labelledby="offline-topic-title">
      <h1 id="offline-topic-title" className="mb-3 text-2xl font-semibold">{title}</h1>
      <OfflineNotice message="Content not available while offline." />
    </section>
  );
}

// A `= {}` default parameter evaluates to a NEW object on every call when the caller
// doesn't pass previewFileUrls (the normal student-viewing route never does). That fresh
// identity was flowing down into markdownInstruction.jsx's content-load effect dependency
// array, making it think something changed and re-fetch/fade on every render (e.g. every
// progress heartbeat). A stable module-level default fixes that.
const EMPTY_PREVIEW_FILE_URLS = {};
// Schedules are stored separately in the offline package and read through
// getScheduleTopicContent, so they remain available alongside reading topics.
const OFFLINE_READABLE_TOPIC_TYPES = new Set(['instruction', 'project', 'schedule']);

export default function Instruction({ courseOps, learningSession, user, content = null, instructionState = 'learning', previewFileUrls = EMPTY_PREVIEW_FILE_URLS }) {
  const isOnline = useOnlineStatus();
  const [loadingProgress, setLoadingProgress] = React.useState(true);

  React.useEffect(() => {
    // Guards against out-of-order resolution: if enrollment.id changes again (e.g. the
    // observe-session race in app.jsx briefly resolving to two different enrollments in
    // quick succession) before this fetch resolves, a stale response must not overwrite the
    // interaction store with the wrong learner's answers.
    let cancelled = false;
    if (learningSession.course?.offlineCached || !isOnline) {
      setLoadingProgress(false);
      return () => { cancelled = true; };
    }
    // The attendance and Terms & Sections views are synthetic topics with no interactions.
    if (learningSession.topic?.type === 'attendance' || learningSession.topic?.type === 'sections' || learningSession.topic?.type === 'mastery') {
      setLoadingProgress(false);
      return;
    }
    courseOps.getTopicProgress(['quizSubmit', 'canvasGradebookSubmit']).then((progress) => {
      if (cancelled) return;
      // Replace (not merge into) the store: addInteractionProgress/updateInteractionProgress
      // only ever add/overwrite keys present in `progress`, so an interaction the
      // currently-viewed learner never submitted would otherwise keep showing whichever
      // OTHER learner's answer was left over from before - e.g. exiting observe mode after
      // viewing a learner who completed an interaction you personally haven't.
      replaceAllInteractionProgress(new Map(Object.entries(progress).map(([key, value]) => [key, value.details || {}])));
      setLoadingProgress(false);
    });
    // Only re-fetch when the topic or enrollment actually changes, not on every
    // learningSession reference change (e.g. the periodic progress heartbeat updating
    // lastActivityAt). Re-running this on every heartbeat re-publishes stale interaction
    // snapshots into the interaction store, clobbering in-progress unsaved interactions.
    return () => {
      cancelled = true;
    };
  }, [learningSession.topic?.id, learningSession.enrollment?.id, learningSession.course?.offlineCached, isOnline]);

  useProgressTracking({
    progressType: `${learningSession.topic.type || 'instruction'}View`,
    onProgress: courseOps?.addProgress,
    enabled: isOnline && !learningSession.course?.offlineCached && !content && !!learningSession.topic?.path && learningSession.topic?.type !== 'attendance' && learningSession.topic?.type !== 'sections' && learningSession.topic?.type !== 'mastery' && !!courseOps?.addProgress,
    minDuration: 10,
    dependencies: [learningSession.course?.id, learningSession.enrollment?.id, learningSession.topic?.id, learningSession.topic?.path],
  });

  const offline = Boolean(learningSession.course?.offlineCached) || !isOnline;
  const topic = learningSession.topic;
  // Older course definitions can omit `type`; the editor and progress tracking both
  // treat that as the default instruction type, so offline reading must do the same.
  const topicType = topic?.type || 'instruction';
  if (offline && topic && !OFFLINE_READABLE_TOPIC_TYPES.has(topicType)) {
    return <OfflineUnavailable title={topic.title} />;
  }

  if (loadingProgress) {
    return null;
  }

  const contentAvailable = topic && topic.path && (!topic.state || topic.state === 'published');
  if (!contentAvailable) {
    return null;
  }

  let instructionComponent;
  switch (learningSession.topic.type) {
    case 'embedded':
    case 'video':
      instructionComponent = <EmbeddedInstruction learningSession={learningSession} />;
      break;
    case 'exam':
      instructionComponent = <ExamInstruction courseOps={courseOps} learningSession={learningSession} user={user} content={content} instructionState={instructionState} previewFileUrls={previewFileUrls} />;
      break;
    case 'attendance':
      instructionComponent = <AttendanceInstruction courseOps={courseOps} learningSession={learningSession} user={user} />;
      break;
    case 'schedule':
      instructionComponent = <ScheduleInstruction courseOps={courseOps} learningSession={learningSession} user={user} instructionState={instructionState} />;
      break;
    case 'sections':
      instructionComponent = <SectionsAdminView courseOps={courseOps} />;
      break;
    case 'mastery':
      instructionComponent = <MasteryInstruction courseOps={courseOps} />;
      break;
    case 'dra':
      instructionComponent = <DraInstruction courseOps={courseOps} learningSession={learningSession} user={user} content={content} instructionState={instructionState} />;
      break;
    case 'interview':
      instructionComponent = <InterviewInstruction courseOps={courseOps} learningSession={learningSession} user={user} content={content} instructionState={instructionState} />;
      break;
    default:
      instructionComponent = <InteractionInstruction courseOps={courseOps} learningSession={learningSession} user={user} content={content} instructionState={instructionState} previewFileUrls={previewFileUrls} />;
      break;
  }

  return instructionComponent;
}
