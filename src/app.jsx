import React, { useState } from 'react';
import Toolbar from './toolbar';
import Instruction from './views/instruction/instruction.jsx';
import useCourseOperations from './hooks/useCourseOperations';

import Editor from './views/editor/editor.jsx';
import Sidebar from './sidebar';
import Start from './start.jsx';
import Dashboard from './views/dashboard/dashboard.jsx';
import service from './service/service.js';

function App() {
  const [loaded, setLoaded] = useState(false);
  const [user, setUser] = useState(null);
  const [course, setCourse] = React.useState(null);
  const [enrollment, setEnrollment] = React.useState(null);
  const [topic, setTopic] = React.useState({ title: '', path: '' });
  const [editorVisible, setEditorVisible] = useState(false);
  const courseRef = React.useRef(course);
  courseRef.current = course;

  const courseOps = useCourseOperations(user, setUser, service, course, setCourse, topic, setTopic, enrollment, setEnrollment);

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

  const sidebarVisible = enrollment?.settings.sidebarVisible ?? false;

  function manipulateSidebar(visible) {
    setEnrollment((previous) => {
      const next = { ...previous, settings: { ...previous.settings, sidebarVisible: visible } };
      service.saveEnrollment(next);
      return next;
    });
  }

  function toggleEditor() {
    setEditorVisible((prev) => !prev);
  }

  // What to show before we know who the user is
  if (!loaded) {
    return (
      <div className="flex flex-col h-screen">
        <div className="m-auto text-gray-400">Loading...</div>
      </div>
    );
  } else if (!user) {
    return <Start setUser={setUser} />;
  } else if (!course) {
    return <Dashboard courseOps={courseOps} service={service} user={user} setUser={setUser} loadCourse={courseOps.loadCourse} />;
  }

  // What to show in the main content area
  let content = <Instruction topic={topic} changeTopic={courseOps.changeTopic} course={course} navigateToAdjacentTopic={courseOps.navigateToAdjacentTopic} />;
  if (editorVisible) {
    content = <Editor service={service} user={user} course={course} setCourse={setCourse} currentTopic={topic} changeTopic={courseOps.changeTopic} />;
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="items-center border-b-1 bg-amber-50 border-gray-200 hidden sm:block ">
        <h1 className="font-semibold text-lg text-gray-700">
          <span className="inline-block bg-white border border-gray-300 rounded-full w-[32px] px-1.5 py-0.5  m-1">💡</span> {course.title}
        </h1>
      </header>

      <Toolbar user={user} course={course} closeCourse={courseOps.closeCourse} sidebarVisible={sidebarVisible} manipulateSidebar={manipulateSidebar} currentTopic={topic} changeTopic={courseOps.changeTopic} navigateToAdjacentTopic={courseOps.navigateToAdjacentTopic} editing={editorVisible} toggleEditor={toggleEditor} />

      <div className="flex flex-1 overflow-hidden">
        <div className={`transition-all duration-300 ease-in-out overflow-hidden ${sidebarVisible ? 'flex w-full sm:w-[300px] opacity-100' : 'w-0 opacity-0'}`}>
          <Sidebar courseOps={courseOps} service={service} user={user} enrollment={enrollment} setCourse={setCourse} course={course} currentTopic={topic} changeTopic={courseOps.changeTopic} editorVisible={editorVisible} navigateToAdjacentTopic={courseOps.navigateToAdjacentTopic} />
        </div>
        {content}
      </div>
    </div>
  );
}

export default App;
