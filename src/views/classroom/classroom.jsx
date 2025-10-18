import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import Toolbar from './toolbar';
import Sidebar from './sidebar';
import Instruction from '../../components/instruction/instruction.jsx';
import Editor from '../../components/editor/editor.jsx';

export default function Classroom({ courseOps, service, user, course, topic, settings }) {
  const [editorVisible, setEditorVisible] = useState(false);
  const isResizing = React.useRef(false);

  // If the courseId in the URL changes, load that course
  const { courseId } = useParams();
  React.useEffect(() => {
    if (user && courseId !== (course ? course.id : null)) {
      service.enrollment(user.id, courseId).then((enrollment) => {
        courseOps.loadCourse(enrollment);
      });
    }
  }, [courseId, user]);

  React.useEffect(() => {
    if (course) {
      document.title = `MasteryLS - ${course.title}`;
    }
  }, [course]);

  React.useEffect(() => {
    const minSidebarWidth = 50;
    const maxSidebarWidth = window.innerWidth * 0.75;

    function handleMove(clientX) {
      if (isResizing.current) {
        let newWidth = clientX;
        newWidth = Math.max(minSidebarWidth, Math.min(maxSidebarWidth, newWidth));
        if (newWidth <= minSidebarWidth) {
          courseOps.saveEnrollmentUiSettings(course.id, { sidebarVisible: false });
        } else {
          courseOps.saveEnrollmentUiSettings(course.id, { sidebarWidth: newWidth });
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
    //    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    // window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      //      window.removeEventListener('touchmove', handleTouchMove);
      // window.removeEventListener('touchend', handleEnd);
    };
  }, [settings.sidebarVisible]);

  function toggleEditor() {
    setEditorVisible((prev) => !prev);
  }

  if (!course) {
    return <div className="p-8" />;
  }

  // When the course is displayed
  let content = <Instruction courseOps={courseOps} topic={topic} course={course} user={user} />;
  if (editorVisible) {
    content = <Editor courseOps={courseOps} service={service} user={user} course={course} currentTopic={topic} />;
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
              <Sidebar courseOps={courseOps} service={service} user={user} course={course} currentTopic={topic} editorVisible={editorVisible} />
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
