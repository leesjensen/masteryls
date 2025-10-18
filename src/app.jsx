import React, { useState, useEffect } from 'react';
import { createBrowserRouter, RouterProvider, Outlet, useOutletContext, useNavigate } from 'react-router-dom';
import useCourseOperations from './hooks/useCourseOperations';

import Start from './start.jsx';
import Dashboard from './views/dashboard/dashboard.jsx';
import service from './service/service.js';
import Classroom from './views/classroom/classroom.jsx';
import ErrorPage from './components/errorPage.jsx';

const defaultUiSettings = { editing: false, tocIndexes: [0], sidebarVisible: true, sidebarWidth: 300, currentTopic: null };

function RootLayout() {
  const [loaded, setLoaded] = useState(false);
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
      navigate('/course', { replace: true });
    } else {
      navigate('/dashboard', { replace: true });
    }
  }

  const courseOps = useCourseOperations(user, setUserInternal, service, course, setCourseInternal, setSettings, topic, setTopic);

  React.useEffect(() => {
    (async () => {
      try {
        const savedUser = await service.currentUser();
        if (savedUser) {
          setUser(savedUser);

          const enrollment = await service.currentEnrollment(savedUser.id);
          if (enrollment) {
            courseOps.loadCourse(enrollment);
          }
        }
      } finally {
        setLoaded(true);
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
    loaded,
  };

  return (
    <div className='app'>
      <main>
        <Outlet context={contextValue} />
      </main>
    </div>
  );
}

function App() {
  function StartPage() {
    const { setUser, user, loaded } = useOutletContext();
    const navigate = useNavigate();

    useEffect(() => {
      // If we've finished loading and there's a logged-in user, skip start and go to dashboard
      if (loaded && user) navigate('/dashboard', { replace: true });
    }, [loaded, user, navigate]);

    return <Start setUser={setUser} />;
  }

  function DashboardPage() {
    const { courseOps, service, user } = useOutletContext();
    return <Dashboard courseOps={courseOps} service={service} user={user} />;
  }

  function ClassroomPage() {
    const { courseOps, service, user, course, topic, settings, setCourse } = useOutletContext();
    return <Classroom courseOps={courseOps} service={service} user={user} course={course} topic={topic} settings={settings} setCourse={setCourse} />;
  }

  const router = createBrowserRouter([
    {
      path: '/',
      element: <RootLayout />,
      errorElement: <ErrorPage message='The gerbils followed the lemmings off the cliff.' />, // Global error boundary
      children: [
        { index: true, element: <StartPage /> },
        { path: 'dashboard', element: <DashboardPage /> },
        { path: 'course', element: <ClassroomPage /> },
        { path: '*', element: <ErrorPage message='The gerbils have gotten lost.' /> },
      ],
    },
  ]);

  return <RouterProvider router={router} />;
}

export default App;
