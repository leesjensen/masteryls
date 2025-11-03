import React, { useState } from 'react';
import { createBrowserRouter, RouterProvider, Outlet, useOutletContext, useNavigate, useLocation } from 'react-router-dom';
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

function App() {
  const router = createBrowserRouter([
    {
      path: '/',
      element: <RootLayout />,
      errorElement: <ErrorPage message="The gerbils followed the lemmings off the cliff." />,
      children: [
        { index: true, element: <LoadingPage /> },
        { path: 'start', element: <StartPage /> },
        { path: 'dashboard', element: <DashboardPage /> },
        { path: 'course/:courseId', element: <ClassroomPage /> },
        { path: 'metrics', element: <MetricsPage /> },
        { path: 'createCourse', element: <CreateCoursePage /> },
        { path: 'progress', element: <ProgressPage /> },
        { path: '*', element: <ErrorPage message="The gerbils have gotten lost." /> },
      ],
    },
  ]);

  return <RouterProvider router={router} />;
}

function RootLayout() {
  const defaultUiSettings = { editing: false, tocIndexes: [0], sidebarVisible: 'split', sidebarWidth: 300, currentTopic: null };

  const [user, setUser] = useState(null);
  const [course, setCourse] = useState(null);
  const [topic, setTopic] = useState({ title: '', path: '' });
  const [settings, setSettings] = useState(defaultUiSettings);
  const navigate = useNavigate();
  const location = useLocation();

  function setUserInternal(user) {
    setUser(user);
    if (user) {
      navigate('/dashboard');
    } else {
      navigate('/start');
    }
  }

  function setCourseInternal(course) {
    setCourse(course);
    if (course) {
      navigate(`/course/${course.id}`);
    } else {
      navigate('/dashboard');
    }
  }

  const courseOps = useCourseOperations(user, setUserInternal, service, course, setCourseInternal, setSettings, topic, setTopic);

  React.useEffect(() => {
    (async () => {
      const savedUser = await service.currentUser();
      if (savedUser) {
        setUser(savedUser);
        if (location.pathname === '/') {
          const enrollment = await service.currentEnrollment(savedUser.id);
          if (enrollment) {
            navigate(`/course/${enrollment.catalogId}`);
          } else {
            navigate('/dashboard');
          }
        }
      } else {
        navigate('/start');
      }
    })();
  }, []);

  // Pass all shared state through Outlet context
  const contextValue = {
    user,
    setUser: setUserInternal,
    course,
    setCourse: setCourseInternal,
    topic,
    setTopic,
    settings,
    setSettings,
    courseOps,
    service,
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

function LoadingPage() {
  return (
    <div className="flex items-center justify-center h-full bg-gradient-to-br from-gray-50to-gray-200">
      <div className="text-center">
        <div className="inline-block">
          <div className="w-16 h-16 border-8 border-amber-200 border-t-amber-600 rounded-full animate-spin mx-auto mb-4"></div>
        </div>
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">Loading</h2>
        <p className="text-gray-600">The gerbils are working hard to get your content ready!</p>
      </div>
    </div>
  );
}

function StartPage() {
  const { courseOps, setUser, user } = useOutletContext();
  return <Start courseOps={courseOps} setUser={setUser} />;
}

function DashboardPage() {
  const { courseOps, service, user } = useOutletContext();
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
  const { courseOps } = useOutletContext();
  return <ProgressView courseOps={courseOps} />;
}

function ClassroomPage() {
  const { courseOps, service, user, course, topic, settings, setCourse } = useOutletContext();
  return <ClassroomView courseOps={courseOps} service={service} user={user} course={course} topic={topic} settings={settings} setCourse={setCourse} />;
}

export default App;
