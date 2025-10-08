import React, { useState } from 'react';
import Toolbar from './toolbar';
import Instruction from './views/instruction/instruction.jsx';
import useCourseOperations from './hooks/useCourseOperations';

import Editor from './views/editor/editor.jsx';
import Sidebar from './sidebar';
import Start from './start.jsx';
import Dashboard from './views/dashboard/dashboard.jsx';
import service from './service/service.js';

const defaultUiSettings = { editing: false, tocIndexes: [0], sidebarVisible: true, sidebarWidth: 300, currentTopic: null };

function App() {
  const [loaded, setLoaded] = useState(false);
  const [user, setUser] = useState(null);
  const [course, setCourse] = React.useState(null);
  const [topic, setTopic] = React.useState({ title: '', path: '' });
  const [editorVisible, setEditorVisible] = useState(true);
  const [settings, setSettings] = useState(defaultUiSettings);
  const courseRef = React.useRef(course);
  const isResizing = React.useRef(false);
  courseRef.current = course;

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

  React.useEffect(() => {
    const minSidebarWidth = 50;
    const maxSidebarWidth = window.innerWidth * 0.75;

    function handleMove(clientX) {
      if (isResizing.current) {
        let newWidth = clientX;
        newWidth = Math.max(minSidebarWidth, Math.min(maxSidebarWidth, newWidth));
        if (newWidth <= minSidebarWidth) {
          courseOps.saveEnrollmentUiSettings(courseRef.current.id, { sidebarVisible: false });
        } else {
          courseOps.saveEnrollmentUiSettings(courseRef.current.id, { sidebarWidth: newWidth });
        }
      }
    }

    function handleMouseMove(e) {
      handleMove(e.clientX);
    }

    function handleTouchMove(e) {
      e.preventDefault(); // Prevent scrolling while dragging
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX);
      }
    }

    function handleEnd() {
      isResizing.current = false;
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [settings.sidebarVisible]);

  function toggleEditor() {
    setEditorVisible((prev) => !prev);
  }

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

  // When the course is displayed
  let content = <Instruction courseOps={courseOps} topic={topic} course={course} user={user} />;
  if (editorVisible) {
    content = <Editor courseOps={courseOps} service={service} user={user} course={course} setCourse={setCourse} currentTopic={topic} />;
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="items-center border-b-1 bg-amber-50 border-gray-200 hidden sm:block ">
        <h1 className="font-semibold text-lg text-gray-700">
          <span className="inline-block bg-white border border-gray-300 rounded-full w-[32px] px-1.5 py-0.5  m-1">💡</span> {course.title} - {topic.title}
        </h1>
      </header>

      <nav>
        <Toolbar courseOps={courseOps} user={user} course={course} settings={settings} topic={topic} editing={editorVisible} toggleEditor={toggleEditor} />
      </nav>

      <main className="flex flex-1 overflow-hidden">
        {settings.sidebarVisible && (
          <>
            <div className={`overflow-hidden ${settings.sidebarVisible ? 'flex opacity-100' : 'w-0 opacity-0'}`} style={{ width: settings.sidebarWidth }}>
              <Sidebar courseOps={courseOps} service={service} user={user} setCourse={setCourse} course={course} currentTopic={topic} editorVisible={editorVisible} />
            </div>
            <div
              className="w-[6px] cursor-col-resize bg-gray-200 z-10 hover:bg-amber-300 transition-colors touch-none"
              onMouseDown={() => {
                isResizing.current = true;
              }}
              onTouchStart={() => {
                isResizing.current = true;
              }}
            />
          </>
        )}
        <div id="editor" className="flex flex-1 h-full overflow-auto">
          {content}
        </div>
      </main>
    </div>
  );
}

export default App;
