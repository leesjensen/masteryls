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
import MetricsView from './views/metrics/metricsView.jsx';
import CourseCreationView from './views/courseCreation/courseCreationView.jsx';
import CourseLinkView from './views/courseExport/courseLinkView.jsx';
import MasteryView from './views/masteryView/masteryView.jsx';
import LearnerMasteryView from './views/masteryView/learnerMasteryView.jsx';
import ProgressView from './views/progress/ProgressView.jsx';
import AboutView from './views/about/aboutView.jsx';
import DemoCoursesView from './views/demoCourses/demoCoursesView.jsx';
import ErrorPage from './components/errorPage.jsx';
import { PwaStatusToasts } from './components/PwaInstallControls.jsx';
import service from './service/service.js';

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
        { path: 'metrics', element: <MetricsPage /> },
        { path: 'courseCreation', element: <CourseCreationPage /> },
        { path: 'courseLink', element: <CourseLinkPage /> },
        { path: 'masteryview', element: <MasteryViewPage /> },
        { path: 'masteryview/course/:courseId', element: <MasteryViewPage /> },
        { path: 'masteryview/learner/:learnerId', element: <LearnerMasteryViewPage /> },
        { path: 'masteryview/learner/:learnerId/course/:courseId', element: <LearnerMasteryViewPage /> },
        { path: 'progress', element: <ProgressPage /> },
        { path: '*', element: <ErrorPage user={user} message="It seems we have gotten lost." /> },
      ],
    },
  ]);
}

function App({ initialUser }) {
  const defaultUiSettings = { tocIndexes: [0], sidebarVisible: 'split', sidebarWidth: 300, currentTopic: null };

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
          const topicPath = enrollmentUiSettings?.currentTopic ? (enrollmentUiSettings.currentTopic === 'schedule' ? '/schedule' : `/topic/${enrollmentUiSettings.currentTopic}`) : '';
          navigate(`/course/${enrollment.catalogId}${topicPath}`);
        } else {
          navigate('/dashboard');
        }
      }
    })();
  }, []);

  function setUserInternal(user) {
    setUser(user);
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
    service,
    learningSession,
    setLearningSession,
    observeSession,
    startObserveSession,
    exitObserveSession,
  };

  return (
    <div className="app flex min-h-dvh flex-col bg-white">
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

function MetricsPage() {
  const { courseOps } = useOutletContext();
  return <MetricsView courseOps={courseOps} />;
}

function CourseCreationPage() {
  const { courseOps } = useOutletContext();
  return <CourseCreationView courseOps={courseOps} />;
}

function CourseLinkPage() {
  const { courseOps } = useOutletContext();
  return <CourseLinkView courseOps={courseOps} />;
}

function MasteryViewPage() {
  const { courseOps, startObserveSession } = useOutletContext();
  return <MasteryView courseOps={courseOps} startObserveSession={startObserveSession} />;
}

function LearnerMasteryViewPage() {
  const { courseOps } = useOutletContext();
  return <LearnerMasteryView courseOps={courseOps} />;
}

function ProgressPage() {
  const { courseOps, service, user } = useOutletContext();
  return <ProgressView courseOps={courseOps} service={service} user={user} />;
}

function ClassroomPage() {
  const { courseOps, service, user, learningSession, setLearningSession, settings, observeSession, exitObserveSession } = useOutletContext();
  const [errorMsg, setErrorMsg] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { setSearchResults } = useSearchResults();

  const { courseId, topicId } = useParams();
  React.useEffect(() => {
    (async () => {
      try {
        if (courseId !== null) {
          const isScheduleRoute = location.pathname.endsWith('/schedule');
          let course = learningSession?.course;
          if (!course || course.id !== courseId) {
            course = await courseOps.getCourse(courseId);
            if (course) {
              service.setCourseUiSettings(courseId);
              setSearchResults(null);
            }
          }

          let topic = learningSession?.topic;
          if (course) {
            const redirectToDefaultTopic = (saveAsCurrentTopic = false) => {
              const targetTopic = course.defaultTopic();
              if (!targetTopic) throw new Error('No default topic found for course');
              if (saveAsCurrentTopic) {
                courseOps.saveEnrollmentUiSettings(courseId, { currentTopic: targetTopic.id });
              }
              navigate(`/course/${courseId}/topic/${targetTopic.id}`);
            };

            if (isScheduleRoute) {
              topic = courseOps.getScheduleTopic(course);
              if (topic) {
                courseOps.saveEnrollmentUiSettings(courseId, { currentTopic: 'schedule' });
              } else {
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

          const { observeForCourse, learnerId } = getEffectiveLearnerId({ userId: user?.id, courseId: course.id, observeSession });
          const enrollment = learnerId ? await service.enrollment(learnerId, course.id) : null;
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
