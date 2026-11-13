import React, { useState } from 'react';
import { createBrowserRouter, Outlet, useOutletContext, useNavigate, useLocation } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { useSearchResults } from './hooks/useSearchResults';
import useCourseOperations from './hooks/useCourseOperations';
import useObserveSession, { getEffectiveLearnerId } from './hooks/useObserveSession.jsx';

import Start from './start.jsx';
import { AppBar } from './appBar.jsx';
import DashboardView from './views/dashboard/dashboardView.jsx';
import ClassroomView from './views/classroom/classroomView.jsx';
import CourseCreationView from './views/courseCreation/courseCreationView.jsx';
import CourseLinkView from './views/courseExport/courseLinkView.jsx';
import ProgressView from './views/progress/ProgressView.jsx';
import AboutView from './views/about/aboutView.jsx';
import DemoCoursesView from './views/demoCourses/demoCoursesView.jsx';
import ErrorPage from './components/errorPage.jsx';
import { PwaStatusToasts } from './components/PwaInstallControls.jsx';
import service from './service/service.js';
import { setObservabilityUser } from './observability/observability.js';

export function createAppRouter(user) {
  return createBrowserRouter([
    {
      path: '/',
      element: <App initialUser={user} />,
      errorElement: <ErrorPage user={user} />,
      children: [
        { index: true, element: <StartPage /> },
        { path: 'demo-courses', element: <DemoCoursesPage /> },
        { path: 'about', element: <AboutPage /> },
        { path: 'dashboard', element: <DashboardPage /> },
        { path: 'course/:courseId', element: <ClassroomPage /> },
        { path: 'course/:courseId/topic/:topicId', element: <ClassroomPage /> },
        { path: 'course/:courseId/schedule', element: <ClassroomPage /> },
        { path: 'course/:courseId/attendance', element: <ClassroomPage /> },
        { path: 'course/:courseId/sections', element: <ClassroomPage /> },
        { path: 'course/:courseId/mastery', element: <ClassroomPage /> },
        { path: 'course/:courseId/mastery/learner/:learnerId', element: <ClassroomPage /> },
        { path: 'courseCreation', element: <CourseCreationPage /> },
        { path: 'courseLink', element: <CourseLinkPage /> },
        { path: 'progress', element: <ProgressPage /> },
        { path: '*', element: <ErrorPage user={user} message="It seems we have gotten lost." /> },
      ],
    },
  ]);
}

function App({ initialUser }) {
  const defaultUiSettings = { tocIndexes: [0], sidebarVisible: 'split', sidebarWidth: 300, currentTopic: null, selectedSidebarTab: 'topics' };

  const [user, setUser] = useState(initialUser);
  const [settings, setSettings] = useState(defaultUiSettings);
  const [learningSession, setLearningSession] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { observeSession, startObserveSession, exitObserveSession, clearObserveSession } = useObserveSession(user);

  React.useEffect(() => {
    (async () => {
      if (location.pathname === '/' && initialUser) {
        const enrollment = await service.currentEnrollment(initialUser.id);
        if (enrollment) {
          const enrollmentUiSettings = service.getEnrollmentUiSettings(enrollment.catalogId);
          const currentTopic = enrollmentUiSettings?.currentTopic;
          const topicPath = currentTopic ? (currentTopic === 'schedule' || currentTopic === 'attendance' ? `/${currentTopic}` : `/topic/${currentTopic}`) : '';
          // Seed history as [dashboard, course]: replace '/' with the dashboard, then push the last
          // course. Auto-opening the course no longer traps the back button on the redirecting '/',
          // and pressing back from the course lands on the dashboard. Await the replace so it commits
          // before the push (a data router can otherwise abort the first navigation with the second).
          await navigate('/dashboard', { replace: true });
          navigate(`/course/${enrollment.catalogId}${topicPath}`);
        } else {
          navigate('/dashboard', { replace: true });
        }
      }
    })();
  }, []);

  function setUserInternal(user) {
    setUser(user);
    // Re-tag telemetry when the user changes (login after an anonymous start, or logout).
    setObservabilityUser(user);
    if (!user) {
      clearObserveSession();
    }
    if (user) {
      navigate('/dashboard');
    } else {
      navigate('/');
    }
  }

  const courseOps = useCourseOperations(user, setUserInternal, service, learningSession, setLearningSession, setSettings, observeSession);

  // Pass all shared state through Outlet context
  const contextValue = {
    courseOps,
    user,
    settings,
    setSettings,
    service,
    learningSession,
    setLearningSession,
    observeSession,
    startObserveSession,
    exitObserveSession,
  };

  return (
    <div className="app flex h-dvh flex-col bg-white">
      <div className="flex-[0_0_42px]">
        <AppBar user={user} courseOps={courseOps} />
      </div>
      <div className="flex-1 flex flex-col overflow-auto">
        <Outlet context={contextValue} />
      </div>
      <PwaStatusToasts />
    </div>
  );
}

function StartPage() {
  const { courseOps, user } = useOutletContext();

  if (user) return <div></div>;

  return <Start courseOps={courseOps} />;
}

function DashboardPage() {
  const { courseOps, service, user } = useOutletContext();
  service.removeCourseUiSettings();
  return <DashboardView courseOps={courseOps} service={service} user={user} />;
}

function AboutPage() {
  return <AboutView />;
}

function DemoCoursesPage() {
  const { courseOps } = useOutletContext();
  return <DemoCoursesView courseOps={courseOps} />;
}

function CourseCreationPage() {
  const { courseOps } = useOutletContext();
  return <CourseCreationView courseOps={courseOps} />;
}

function CourseLinkPage() {
  const { courseOps } = useOutletContext();
  return <CourseLinkView courseOps={courseOps} />;
}

function ProgressPage() {
  const { courseOps, service, user } = useOutletContext();
  return <ProgressView courseOps={courseOps} service={service} user={user} />;
}

function ClassroomPage() {
  const { courseOps, service, user, learningSession, setLearningSession, settings, setSettings, observeSession, exitObserveSession } = useOutletContext();
  const [errorMsg, setErrorMsg] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { setSearchResults } = useSearchResults();

  const { courseId, topicId } = useParams();
  // Tracks the most recently started invocation of the effect below. On load,
  // `observeSession` starts null and is asynchronously replaced once useObserveSession
  // restores it from localStorage, so this effect can fire twice in quick succession (once
  // as "myself", once as "the observed learner") with no guarantee the later-started one
  // resolves last. Without this guard, whichever async fetch happens to resolve last wins,
  // regardless of which invocation it belongs to - silently flipping observeMode and the
  // loaded enrollment back and forth depending on network timing.
  const latestEffectSeqRef = React.useRef(0);
  React.useEffect(() => {
    const seq = ++latestEffectSeqRef.current;
    (async () => {
      try {
        if (courseId !== null) {
          const isScheduleRoute = location.pathname.endsWith('/schedule');
          const isAttendanceRoute = location.pathname.endsWith('/attendance');
          const isSectionsRoute = location.pathname.endsWith('/sections');
          const isMasteryRoute = location.pathname.endsWith('/mastery') || location.pathname.includes('/mastery/learner/');
          let course = learningSession?.course;
          if (!course || course.id !== courseId) {
            course = await courseOps.getCourse(courseId);
            if (course) {
              service.setCourseUiSettings(courseId);
              setSearchResults(null);
            }
          }

          // Resolve the viewer's enrollment up front: the mastery route's synthetic topic depends on
          // it (a learner reaches their own mastery view only when enrolled), and a fresh load/refresh
          // has not populated learningSession.enrollment yet - without this, refreshing /mastery as a
          // learner fell through to the default topic.
          const { observeForCourse, learnerId } = getEffectiveLearnerId({ userId: user?.id, courseId: course?.id, observeSession });
          const enrollment = course && learnerId ? await service.enrollment(learnerId, course.id) : null;
          if (seq !== latestEffectSeqRef.current) return;

          // Restore classroom UI state for every route. Schedule and Attendance happen to save
          // currentTopic while loading, which also refreshes React state from localStorage; the
          // synthetic Mastery/Sections routes intentionally do not save a landing topic.
          setSettings(service.getEnrollmentUiSettings(courseId));

          let topic = learningSession?.topic;
          if (course) {
            const redirectToDefaultTopic = (saveAsCurrentTopic = false) => {
              const targetTopic = course.defaultTopic();
              if (!targetTopic) throw new Error('No default topic found for course');
              if (saveAsCurrentTopic) {
                courseOps.saveEnrollmentUiSettings(courseId, { currentTopic: targetTopic.id });
              }
              // Replace (not push): this is a redirect from a bare/invalid course URL to the canonical
              // topic URL. Pushing would leave the bare `/course/:id` entry in history, and pressing
              // back onto it would just re-redirect here - trapping the back button inside the course.
              navigate(`/course/${courseId}/topic/${targetTopic.id}`, { replace: true });
            };

            if (isScheduleRoute) {
              topic = courseOps.getScheduleTopic(course);
              if (topic) {
                courseOps.saveEnrollmentUiSettings(courseId, { currentTopic: 'schedule' });
              } else {
                redirectToDefaultTopic();
                return;
              }
            } else if (isAttendanceRoute) {
              topic = courseOps.getAttendanceTopic(course);
              if (topic) {
                courseOps.saveEnrollmentUiSettings(courseId, { currentTopic: 'attendance' });
              } else {
                redirectToDefaultTopic();
                return;
              }
            } else if (isSectionsRoute) {
              // Editor/root-only management surface. Not persisted as the landing topic (an
              // editor should not reopen into it), so no saveEnrollmentUiSettings here.
              topic = courseOps.getSectionsTopic(course);
              if (!topic) {
                redirectToDefaultTopic();
                return;
              }
            } else if (isMasteryRoute) {
              // Mastery roster (overseer) or per-learner view. Not persisted as the landing topic.
              topic = courseOps.getMasteryTopic(course, enrollment);
              if (!topic) {
                redirectToDefaultTopic();
                return;
              }
            } else if (!topicId) {
              redirectToDefaultTopic();
              return;
            } else if (!topic || topic.id !== topicId) {
              const resolvedTopic = await course.topicFromId(topicId);
              if (resolvedTopic) {
                topic = resolvedTopic;
                courseOps.saveEnrollmentUiSettings(courseId, { currentTopic: topic.id });
              } else {
                redirectToDefaultTopic(true);
                return;
              }
            }
          }

          if (!course || !topic) throw new Error('Course or topic not found');

          // A newer invocation may have started while this one awaited above (enrollment fetch or
          // topic resolution); discard this stale result instead of overwriting the newer one.
          if (seq !== latestEffectSeqRef.current) {
            return;
          }
          setLearningSession({ course, topic, enrollment, observeMode: observeForCourse });
        }
      } catch (error) {
        setErrorMsg(`Unable to load course: ${error.message}`);
      }
    })();
  }, [courseId, topicId, user, location.pathname, observeSession]);

  if (errorMsg) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('You are offline. Reconnect to load course content, submissions, and AI features.');
    }
    throw new Error(errorMsg);
  }

  if (!learningSession) {
    return null;
  }

  return <ClassroomView courseOps={courseOps} user={user} learningSession={learningSession} settings={settings} onExitObserve={exitObserveSession} observedLearnerName={observeSession?.learnerName || ''} />;
}
