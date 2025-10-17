import React, { useState } from 'react';
import { createBrowserRouter, RouterProvider, Outlet, useOutletContext, useNavigate } from 'react-router-dom';
import useCourseOperations from './hooks/useCourseOperations';

import Start from './start.jsx';
import Dashboard from './views/dashboard/dashboard.jsx';
import service from './service/service.js';
import Classroom from './views/classroom/classroom.jsx';

const defaultUiSettings = { editing: false, tocIndexes: [0], sidebarVisible: true, sidebarWidth: 300, currentTopic: null };

// Error component
function ErrorPage({ message }) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center h-screen p-4">
      <h1 className="text-3xl font-bold text-amber-500 mb-4">{message || 'An unexpected error occurred'}</h1>

      <div className="space-x-4">
        <button onClick={() => navigate('/', { replace: true })} className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
          Go Home
        </button>
        <button onClick={() => navigate(0)} className="px-6 py-2 bg-gray-50 text-gray-800 border border-gray-300 rounded hover:bg-gray-600">
          Try Again
        </button>
      </div>
    </div>
  );
}

// Root layout that provides context to all routes
function RootLayout() {
  const [loaded, setLoaded] = useState(false);
  const [user, setUser] = useState(null);
  const [course, setCourse] = React.useState(null);
  const [topic, setTopic] = React.useState({ title: '', path: '' });
  const [settings, setSettings] = useState(defaultUiSettings);
  const navigate = useNavigate();

  function setUserInternal(user) {
    setUser(user);
    navigate('/dashboard', { replace: true });
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
      } catch (error) {
        console.error('Error loading user data:', error);
        // Error boundary will catch this if it bubbles up
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
    <div className="app">
      <main>
        <Outlet context={contextValue} />
      </main>
    </div>
  );
}

// Route component wrappers that use the outlet context
function StartPage() {
  const { setUser } = useOutletContext();

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

// Create the router configuration
const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <ErrorPage message="The gerbils followed the lemmings off the cliff." />, // Global error boundary
    children: [
      {
        index: true, // This replaces path="/" with exact
        element: <StartPage />,
        errorElement: <ErrorPage message="The gerbils followed the lemmings off the cliff." />,
      },
      {
        path: 'dashboard',
        element: <DashboardPage />,
        errorElement: <ErrorPage message="The gerbils followed the lemmings off the cliff." />,
        // Optional: Add a loader for data fetching
        loader: async () => {
          // You can fetch data here and it will be available via useLoaderData()
          // If this throws, the errorElement will catch it
          return null;
        },
      },
      {
        path: 'course',
        element: <ClassroomPage />,
        errorElement: <ErrorPage />,
        loader: async () => {
          // Example: Validate course access
          // throw new Error("Course not found"); // Test error
          return null;
        },
      },
      {
        path: '*',
        element: <ErrorPage message="The gerbils have gotten lost." />,
      },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
