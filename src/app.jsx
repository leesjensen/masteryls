import React, { useState } from 'react';
import { createBrowserRouter, Outlet, useOutletContext, useNavigate, useLocation } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { useSearchResults } from './hooks/useSearchResults';
import useCourseOperations from './hooks/useCourseOperations';

import Start from './start.jsx';
import { AppBar } from './appBar.jsx';
import DashboardView from './views/dashboard/dashboardView.jsx';
import ClassroomView from './views/classroom/classroomView.jsx';
import MetricsView from './views/metrics/metricsView.jsx';
import CourseCreationView from './views/courseCreation/courseCreationView.jsx';
import CourseExportView from './views/courseExport/courseExportView.jsx';
import ProgressView from './views/progress/ProgressView.jsx';
import ErrorPage from './components/errorPage.jsx';
import service from './service/service.js';

export function createAppRouter(user) {
  return createBrowserRouter([
    {
      path: '/',
      element: <App initialUser={user} />,
      errorElement: <ErrorPage user={user} />,
      children: [
        { index: true, element: <StartPage /> },
        { path: 'dashboard', element: <DashboardPage /> },
        { path: 'course/:courseId', element: <ClassroomPage /> },
        { path: 'course/:courseId/topic/:topicId', element: <ClassroomPage /> },
        { path: 'metrics', element: <MetricsPage /> },
        { path: 'courseCreation', element: <CourseCreationPage /> },
        { path: 'courseExport', element: <CourseExportPage /> },
        { path: 'progress', element: <ProgressPage /> },
        { path: '*', element: <ErrorPage user={user} message="It seems we have gotten lost." /> },
      ],
    },
  ]);
}

function App({ initialUser }) {
  const defaultUiSettings = { editing: false, tocIndexes: [0], sidebarVisible: 'split', sidebarWidth: 300, currentTopic: null };

  const [user, setUser] = useState(initialUser);
  const [settings, setSettings] = useState(defaultUiSettings);
  const [learningSession, setLearningSession] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    (async () => {
      if (location.pathname === '/' && initialUser) {
        const enrollment = await service.currentEnrollment(initialUser.id);
        if (enrollment) {
          const enrollmentUiSettings = service.getEnrollmentUiSettings(enrollment.catalogId);
          const topicPath = enrollmentUiSettings?.currentTopic ? `/topic/${enrollmentUiSettings.currentTopic}` : '';
          navigate(`/course/${enrollment.catalogId}${topicPath}`);
        } else {
          navigate('/dashboard');
        }
      }
    })();
  }, []);

  function setUserInternal(user) {
    setUser(user);
    if (user) {
      navigate('/dashboard');
    } else {
      navigate('/');
    }
  }

  const courseOps = useCourseOperations(user, setUserInternal, service, learningSession, setLearningSession, setSettings);

  // Pass all shared state through Outlet context
  const contextValue = {
    courseOps,
    user,
    settings,
    service,
    learningSession,
    setLearningSession,
  };

  return (
    <div className="app flex flex-col h-screen">
      <div className="flex-[0_0_42px]">
        <AppBar user={user} />
      </div>
      <div className="flex-1 flex flex-col overflow-auto">
        <Outlet context={contextValue} />
      </div>
    </div>
  );
}

function StartPage() {
  const { courseOps } = useOutletContext();
  return <Start courseOps={courseOps} />;
}

function DashboardPage() {
  const { courseOps, service, user, setLearningSession } = useOutletContext();
  service.removeCourseUiSettings();
  setLearningSession(null);
  return <DashboardView courseOps={courseOps} service={service} user={user} />;
}

function MetricsPage() {
  const { courseOps } = useOutletContext();
  return <MetricsView courseOps={courseOps} />;
}

function CourseCreationPage() {
  const { courseOps } = useOutletContext();
  return <CourseCreationView courseOps={courseOps} />;
}

function CourseExportPage() {
  const { courseOps } = useOutletContext();
  return <CourseExportView courseOps={courseOps} />;
}

function ProgressPage() {
  const { courseOps, service, user } = useOutletContext();
  return <ProgressView courseOps={courseOps} service={service} user={user} />;
}

function ClassroomPage() {
  const { courseOps, service, user, learningSession, setLearningSession, settings } = useOutletContext();
  const [errorMsg, setErrorMsg] = useState(null);
  const navigate = useNavigate();
  const { setSearchResults } = useSearchResults();

  const { courseId, topicId } = useParams();
  React.useEffect(() => {
    (async () => {
      try {
        if (courseId !== null) {
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
            if (!topicId) {
              topic = course.defaultTopic();
              if (!topic) throw new Error('No default topic found for course');
              navigate(`/course/${courseId}/topic/${topic.id}`);
              return;
            } else if (!topic || topic.id !== topicId) {
              topic = await course.topicFromId(topicId);
              if (topic) {
                courseOps.saveEnrollmentUiSettings(courseId, { currentTopic: topic.id });
              }
            }
          }

          if (!course || !topic) throw new Error('Course or topic not found');

          const enrollment = user?.id ? await service.enrollment(user.id, course.id) : null;
          setLearningSession({ course, topic, enrollment });
        }
      } catch (error) {
        setErrorMsg(`Unable to load course: ${error.message}`);
      }
    })();
  }, [courseId, topicId, user]);

  if (errorMsg) {
    throw new Error(errorMsg);
  }

  if (!learningSession) {
    return null;
  }

  return <ClassroomView courseOps={courseOps} user={user} learningSession={learningSession} settings={settings} />;
}
