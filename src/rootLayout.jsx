import React, { useState } from 'react';
import { createBrowserRouter, Outlet, useOutletContext, useNavigate, useLocation } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import useCourseOperations from './hooks/useCourseOperations';

import Start from './start.jsx';
import AppBar from './appBar.jsx';
import DashboardView from './views/dashboard/dashboardView.jsx';
import ClassroomView from './views/classroom/classroomView.jsx';
import MetricsView from './views/metrics/metricsView.jsx';
import CreateCourseView from './views/createCourse/createCourseView.jsx';
import ProgressView from './views/progress/ProgressView.jsx';
import ErrorPage from './components/errorPage.jsx';
import service from './service/service.js';

export function createRouter(user) {
  return createBrowserRouter([
    {
      path: '/',
      element: <RootLayout initialUser={user} />,
      errorElement: <ErrorPage message="The gerbils followed the lemmings off the cliff." />,
      children: [
        { index: true, element: <StartPage /> },
        { path: 'dashboard', element: <DashboardPage /> },
        { path: 'course/:courseId', element: <ClassroomPage /> },
        { path: 'course/:courseId/topic/:topicId', element: <ClassroomPage /> },
        { path: 'metrics', element: <MetricsPage /> },
        { path: 'createCourse', element: <CreateCoursePage /> },
        { path: 'progress', element: <ProgressPage /> },
        { path: '*', element: <ErrorPage message="The gerbils have gotten lost." /> },
      ],
    },
  ]);
}

function RootLayout({ initialUser }) {
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

  function setCourseInternal(newCourse) {
    if (newCourse) {
      if (!location.pathname.startsWith(`/course/${newCourse.id}`)) {
        navigate(`/course/${newCourse.id}`);
      }
    } else {
      navigate('/dashboard');
    }
  }

  function setTopicInternal(newTopic) {
    if (learningSession && learningSession.topic.id != newTopic.id) {
      navigate(`/course/${learningSession.course.id}/topic/${newTopic.id}`);
    }
  }

  const courseOps = useCourseOperations(user, setUserInternal, service, learningSession, setCourseInternal, setSettings, setTopicInternal);

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
        <AppBar />
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
  const { courseOps, service, user } = useOutletContext();
  service.removeCourseUiSettings();
  return <DashboardView courseOps={courseOps} service={service} user={user} />;
}

function MetricsPage() {
  const { courseOps } = useOutletContext();
  return <MetricsView courseOps={courseOps} />;
}

function CreateCoursePage() {
  const { courseOps } = useOutletContext();
  return <CreateCourseView courseOps={courseOps} />;
}

function ProgressPage() {
  const { courseOps, service, user } = useOutletContext();
  return <ProgressView courseOps={courseOps} service={service} user={user} />;
}

function ClassroomPage() {
  const { courseOps, service, user, learningSession, setLearningSession, settings } = useOutletContext();
  const navigate = useNavigate();

  const { courseId, topicId } = useParams();
  console.log('ClassroomPage render', { courseId, topicId, user, learningSession });
  React.useEffect(() => {
    (async () => {
      if (courseId !== null) {
        let course = learningSession?.course;
        if (!course || course.id !== courseId) {
          course = await courseOps.getCourse(courseId);
          service.setCourseUiSettings(courseId);
        }

        let topic = learningSession?.topic;
        if (!topicId) {
          topic = course.allTopics[0] || { title: '', path: '' };
          navigate(`/course/${courseId}/topic/${topic.id}`);
          return;
        } else if (!topic || topic.id !== topicId) {
          topic = await course.topicFromId(topicId);
          if (topic) {
            courseOps.saveEnrollmentUiSettings(courseId, { currentTopic: topic.id });
          }
        }

        if (course != null && topic != null) {
          const enrollment = user?.id ? await service.enrollment(user.id, course.id) : null;
          setLearningSession({ course, topic, enrollment });
        }
      }
    })();
  }, [courseId, topicId, user]);

  if (!learningSession) {
    return null;
  }

  return <ClassroomView courseOps={courseOps} service={service} user={user} course={learningSession.course} topic={learningSession.topic} settings={settings} />;
}
