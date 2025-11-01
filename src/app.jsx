import React, { useState, useEffect } from 'react';
import { createBrowserRouter, RouterProvider, Outlet, useOutletContext, useNavigate, useLocation } from 'react-router-dom';
import useCourseOperations from './hooks/useCourseOperations';
import { updateAppBar } from './hooks/useAppBarState';

import Start from './start.jsx';
import AppBar from './appBar.jsx';
import Dashboard from './views/dashboard/dashboard.jsx';
import Classroom from './views/classroom/classroom.jsx';
import Metrics from './views/metrics/metrics.jsx';
import ErrorPage from './components/errorPage.jsx';
import service from './service/service.js';

function App() {
  const router = createBrowserRouter([
    {
      path: '/',
      element: <RootLayout />,
      errorElement: <ErrorPage message="The gerbils followed the lemmings off the cliff." />,
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

function RootLayout() {
  const defaultUiSettings = { editing: false, tocIndexes: [0], sidebarVisible: 'split', sidebarWidth: 300, currentTopic: null };

  const [user, setUser] = useState(null);
  const [course, setCourse] = React.useState(null);
  const [topic, setTopic] = React.useState({ title: '', path: '' });
  const [settings, setSettings] = useState(defaultUiSettings);
  const navigate = useNavigate();
  const location = useLocation();

  function setUserInternal(user) {
    setUser(user);
    if (user) {
      navigate('/dashboard');
    } else {
      navigate('/');
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
        const enrollment = await service.currentEnrollment(savedUser.id);
        if (enrollment) {
          navigate(`/course/${enrollment.catalogId}`);
        }
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

function StartPage() {
  const { courseOps, setUser, user } = useOutletContext();
  const navigate = useNavigate();

  useEffect(() => {
    // If the user is already logged in, load their course or go to dashboard
    if (user) {
      (async () => {
        const enrollment = await service.currentEnrollment(user.id);
        if (enrollment) {
          courseOps.loadCourse(enrollment);
        } else {
          navigate('/dashboard');
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

export default App;
