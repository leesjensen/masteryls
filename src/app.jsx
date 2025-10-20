import React, { useState, useEffect } from 'react';
import { createBrowserRouter, RouterProvider, Outlet, useOutletContext, useNavigate } from 'react-router-dom';
import useCourseOperations from './hooks/useCourseOperations';

import Start from './start.jsx';
import Dashboard from './views/dashboard/dashboard.jsx';
import Classroom from './views/classroom/classroom.jsx';
import Metrics from './views/metrics/metrics.jsx';
import ErrorPage from './components/errorPage.jsx';
import service from './service/service.js';

const defaultUiSettings = { editing: false, tocIndexes: [0], sidebarVisible: 'split', sidebarWidth: 300, currentTopic: null };

function RootLayout() {
  const [user, setUser] = useState(null);
  const [course, setCourse] = React.useState(null);
  const [topic, setTopic] = React.useState({ title: '', path: '' });
  const [settings, setSettings] = useState(defaultUiSettings);
  const navigate = useNavigate();

  function setUserInternal(user) {
    setUser(user);
    if (user) {
      navigate('/dashboard', { replace: true });
    } else {
      navigate('/', { replace: true });
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
    <div className="app">
      <main>
        <Outlet context={contextValue} />
      </main>
    </div>
  );
}

function App() {
  function StartPage() {
    const { courseOps, setUser, user } = useOutletContext();
    const navigate = useNavigate();

    useEffect(() => {
      // Pick up where they left off
      if (user) {
        (async () => {
          const enrollment = await service.currentEnrollment(user.id);
          if (enrollment) {
            courseOps.loadCourse(enrollment);
          } else {
            navigate('/dashboard', { replace: true });
          }
        })();
      }
    }, [user?.id, navigate]);

    return <Start courseOps={courseOps} setUser={setUser} />;
  }

  function DashboardPage() {
    const { courseOps, service, user } = useOutletContext();
    return <Dashboard courseOps={courseOps} service={service} user={user} />;
  }
  function MetricsPage() {
    const { courseOps } = useOutletContext();
    return <Metrics courseOps={courseOps} />;
  }

  function ClassroomPage() {
    const { courseOps, service, user, course, topic, settings, setCourse } = useOutletContext();
    return <Classroom courseOps={courseOps} service={service} user={user} course={course} topic={topic} settings={settings} setCourse={setCourse} />;
  }

  const router = createBrowserRouter([
    {
      path: '/',
      element: <RootLayout />,
      errorElement: <ErrorPage message="The gerbils followed the lemmings off the cliff." />, // Global error boundary
      children: [
        { index: true, element: <StartPage /> },
        { path: 'dashboard', element: <DashboardPage /> },
        { path: 'course/:courseId', element: <ClassroomPage /> },
        { path: 'metrics', element: <MetricsPage /> },
        { path: '*', element: <ErrorPage message="The gerbils have gotten lost." /> },
      ],
    },
  ]);

  return <RouterProvider router={router} />;
}

export default App;
