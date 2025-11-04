import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import Toolbar from './toolbar.jsx';
import Sidebar from './sidebar.jsx';
import Instruction from '../../components/instruction/instruction.jsx';
import Editor from '../../components/editor/editor.jsx';
import { updateAppBar } from '../../hooks/useAppBarState.jsx';

export default function ClassroomView({ courseOps, service, user, course, topic, settings }) {
  const [editorVisible, setEditorVisible] = useState(false);
  const isResizing = React.useRef(false);

  // If the courseId in the URL changes, load that course
  const { courseId, topicId } = useParams();
  React.useEffect(() => {
    if (courseId !== null) {
      courseOps.loadCourseById(courseId);
    }
  }, [courseId, user]);

  React.useEffect(() => {
    if (course) {
      const appBarTools = (
        <button title="Close metrics dashboard" onClick={() => courseOps.closeCourse()} className="w-6 m-0.5 p-0.5 text-xs font-medium rounded-xs bg-white border border-gray-300 filter grayscale hover:grayscale-0 hover:border-gray-200 hover:shadow-sm transition-all duration-200 ease-in-out">
          ❌
        </button>
      );

      updateAppBar(course.title, appBarTools);
    }
  }, [course]);

  function splitterMouseDown() {
    isResizing.current = true;
    document.body.style.userSelect = 'none';
  }

  React.useEffect(() => {
    if (course) {
      function handleMove(clientX) {
        const minSidebarWidth = 150;
        const maxSidebarWidth = Math.max(minSidebarWidth, window.innerWidth - minSidebarWidth);

        if (isResizing.current) {
          let newWidth = clientX;
          if (newWidth <= minSidebarWidth) {
            courseOps.saveEnrollmentUiSettings(course.id, { sidebarVisible: 'start' });
          } else if (newWidth >= maxSidebarWidth) {
            courseOps.saveEnrollmentUiSettings(course.id, { sidebarVisible: 'end' });
          } else {
            courseOps.saveEnrollmentUiSettings(course.id, { sidebarVisible: 'split', sidebarWidth: newWidth });
          }
        }
      }

      function handleMouseMove(e) {
        handleMove(e.clientX);
      }

      function handleEnd() {
        isResizing.current = false;
        document.body.style.userSelect = '';
      }

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleEnd);

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleEnd);
      };
    }
  }, [course, settings.sidebarVisible]);

  function toggleEditor() {
    setEditorVisible((prev) => !prev);
  }

  if (!course) {
    return <div className="p-8" />;
  }

  let content = null;
  if (editorVisible) {
    content = <Editor courseOps={courseOps} service={service} user={user} course={course} currentTopic={topic} />;
  } else {
    content = <Instruction courseOps={courseOps} topic={topic} course={course} user={user} />;
  }

  return (
    <>
      <nav>
        <Toolbar courseOps={courseOps} user={user} course={course} settings={settings} topic={topic} editing={editorVisible} toggleEditor={toggleEditor} />
      </nav>

      <main className="flex flex-1 overflow-hidden">
        {settings.sidebarVisible !== 'start' && (
          <div className={`flex overflow-auto`} style={settings.sidebarVisible === 'end' ? { width: '100%' } : { width: settings.sidebarWidth }}>
            <Sidebar courseOps={courseOps} service={service} user={user} course={course} currentTopic={topic} editorVisible={editorVisible} />
          </div>
        )}
        {settings.sidebarVisible === 'split' && <div className="w-[6px] cursor-col-resize bg-gray-200 z-10 hover:bg-amber-300 transition-colors touch-none" onMouseDown={splitterMouseDown} />}
        {settings.sidebarVisible !== 'end' && (
          <div id="content" className={`flex flex-1 h-full overflow-auto`}>
            {content}
          </div>
        )}
      </main>
    </>
  );
}
