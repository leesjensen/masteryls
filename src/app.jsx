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
  const [sidebarVisible, setSidebarVisible] = useState(enrollment?.settings.sidebarVisible ?? true);
  const [sidebarWidth, setSidebarWidth] = useState(window.innerWidth * 0.75);
  const courseRef = React.useRef(course);
  const isResizing = React.useRef(false);
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

  React.useEffect(() => {
    const minSidebarWidth = 50;
    const maxSidebarWidth = window.innerWidth * 0.75;

    function handleMouseMove(e) {
      if (isResizing.current) {
        let newWidth = e.clientX;
        newWidth = Math.max(minSidebarWidth, Math.min(maxSidebarWidth, newWidth));
        if (newWidth <= minSidebarWidth) {
          setSidebarVisible(false);
        } else {
          setSidebarWidth(newWidth);
        }
      }
    }
    function handleMouseUp() {
      isResizing.current = false;
    }
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [sidebarVisible]);

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
  let content = <Instruction courseOps={courseOps} topic={topic} changeTopic={courseOps.changeTopic} course={course} navigateToAdjacentTopic={courseOps.navigateToAdjacentTopic} />;
  if (editorVisible) {
    content = <Editor courseOps={courseOps} service={service} user={user} course={course} setCourse={setCourse} currentTopic={topic} changeTopic={courseOps.changeTopic} />;
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="items-center border-b-1 bg-amber-50 border-gray-200 hidden sm:block ">
        <h1 className="font-semibold text-lg text-gray-700">
          <span className="inline-block bg-white border border-gray-300 rounded-full w-[32px] px-1.5 py-0.5  m-1">💡</span> {course.title} - {topic.title}
        </h1>
      </header>

      <nav>
        <Toolbar user={user} course={course} closeCourse={courseOps.closeCourse} sidebarVisible={sidebarVisible} setSidebarVisible={setSidebarVisible} currentTopic={topic} changeTopic={courseOps.changeTopic} navigateToAdjacentTopic={courseOps.navigateToAdjacentTopic} editing={editorVisible} toggleEditor={toggleEditor} />
      </nav>

      <main className="flex flex-1 overflow-hidden">
        {sidebarVisible && (
          <>
            <div className={`overflow-hidden ${sidebarVisible ? 'flex opacity-100' : 'w-0 opacity-0'}`} style={{ width: sidebarWidth }}>
              <Sidebar courseOps={courseOps} service={service} user={user} enrollment={enrollment} setCourse={setCourse} course={course} currentTopic={topic} changeTopic={courseOps.changeTopic} editorVisible={editorVisible} navigateToAdjacentTopic={courseOps.navigateToAdjacentTopic} />
            </div>
            <div
              className="w-[6px] cursor-col-resize bg-gray-200 z-10 hover:bg-amber-300 transition-colors"
              onMouseDown={() => {
                isResizing.current = true;
              }}
            />
          </>
        )}
        <div className="flex-1 h-full overflow-auto">{content}</div>
      </main>
    </div>
  );
}

export default App;
