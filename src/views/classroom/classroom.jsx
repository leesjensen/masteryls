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
    if (courseId !== (course ? course.id : null)) {
      if (user == null) {
        courseOps.loadCourseById(courseId);
      } else {
        service.enrollment(user.id, courseId).then((enrollment) => {
          courseOps.loadCourse(enrollment);
        });
      }
    }
  }, [courseId, user]);

  React.useEffect(() => {
    if (course) {
      document.title = `MasteryLS - ${course.title}`;
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

  let content = <Instruction courseOps={courseOps} topic={topic} course={course} user={user} />;
  if (editorVisible) {
    content = <Editor courseOps={courseOps} service={service} user={user} course={course} currentTopic={topic} />;
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="items-center border-b-1 bg-gray-900 border-gray-200 hidden sm:block ">
        <h1 className="font-semibold text-lg text-gray-50">
          <span className="inline-block bg-white border border-gray-300 rounded-full w-[32px] px-1.5 py-0.5  m-1">💡</span> {course.title} - {topic.title}
        </h1>
      </header>

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
          <div id="editor" className={`flex flex-1 h-full overflow-auto`}>
            {content}
          </div>
        )}
      </main>
    </div>
  );
}
