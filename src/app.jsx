import React, { useState } from 'react';
import useCourseOperations from './hooks/useCourseOperations';

import Start from './start.jsx';
import Dashboard from './views/dashboard/dashboard.jsx';
import service from './service/service.js';
import Classroom from './views/classroom/classroom.jsx';

const defaultUiSettings = { editing: false, tocIndexes: [0], sidebarVisible: true, sidebarWidth: 300, currentTopic: null };

function App() {
  const [loaded, setLoaded] = useState(false);
  const [user, setUser] = useState(null);
  const [course, setCourse] = React.useState(null);
  const [topic, setTopic] = React.useState({ title: '', path: '' });
  const [settings, setSettings] = useState(defaultUiSettings);

  const courseOps = useCourseOperations(user, setUser, service, course, setCourse, setSettings, topic, setTopic);

  React.useEffect(() => {
    (async () => {
      const savedUser = await service.currentUser();
      if (savedUser) {
        setUser(savedUser);

        const enrollment = await service.currentEnrollment(savedUser.id);
        if (enrollment) {
          courseOps.loadCourse(enrollment);
        }
      }

      setLoaded(true);
    })();
  }, []);

  // When no course is displayed
  if (!loaded) {
    return (
      <div className="flex flex-col h-screen">
        <div className="m-auto text-gray-400">Loading...</div>
      </div>
    );
  } else if (!user) {
    return <Start setUser={setUser} />;
  } else if (!course) {
    return <Dashboard courseOps={courseOps} service={service} user={user} />;
  }

  return <Classroom courseOps={courseOps} service={service} user={user} course={course} topic={topic} settings={settings} setCourse={setCourse} />;
}

export default App;
