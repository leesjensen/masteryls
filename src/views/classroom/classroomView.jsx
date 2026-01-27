import React, { use, useState } from 'react';
import { X } from 'lucide-react';
import Toolbar from './toolbar.jsx';
import Sidebar from './sidebar.jsx';
import Instruction from '../../components/instruction/instruction.jsx';
import Editor from '../../components/editor/editor.jsx';
import { updateAppBar } from '../../hooks/useAppBarState.jsx';
import { AppBarButton } from '../../appBar.jsx';
import { useNavigate } from 'react-router-dom';

export default function ClassroomView({ courseOps, user, learningSession, settings }) {
  const [editorVisible, setEditorVisible] = useState(false);
  const isResizing = React.useRef(false);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (learningSession.course) {
      const url = user ? `/dashboard` : `/`;
      const appBarTools = <AppBarButton icon={X} onClick={() => navigate(url)} title="Close" />;

      updateAppBar({ title: learningSession.course?.title, tools: appBarTools });
    }
  }, [learningSession]);

  function splitterMouseDown() {
    isResizing.current = true;
    document.body.style.userSelect = 'none';
  }

  React.useEffect(() => {
    if (learningSession) {
      function handleMove(clientX) {
        const minSidebarWidth = 150;
        const maxSidebarWidth = Math.max(minSidebarWidth, window.innerWidth - minSidebarWidth);

        if (isResizing.current) {
          let newWidth = clientX;
          if (newWidth <= minSidebarWidth) {
            courseOps.saveEnrollmentUiSettings(learningSession.course.id, { sidebarVisible: 'start' });
          } else if (newWidth >= maxSidebarWidth) {
            courseOps.saveEnrollmentUiSettings(learningSession.course.id, { sidebarVisible: 'end' });
          } else {
            courseOps.saveEnrollmentUiSettings(learningSession.course.id, { sidebarVisible: 'split', sidebarWidth: newWidth });
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
  }, [learningSession, settings.sidebarVisible]);

  function toggleEditor() {
    setEditorVisible((prev) => !prev);
  }

  if (!learningSession?.course) {
    return <div className="p-8" />;
  }

  let content = null;
  if (editorVisible) {
    content = <Editor courseOps={courseOps} user={user} learningSession={learningSession} />;
  } else {
    content = <Instruction courseOps={courseOps} learningSession={learningSession} user={user} />;
  }

  return (
    <>
      <nav>
        <Toolbar courseOps={courseOps} user={user} learningSession={learningSession} settings={settings} editing={editorVisible} toggleEditor={toggleEditor} />
      </nav>

      <main className="flex flex-1 overflow-hidden">
        {settings.sidebarVisible !== 'start' && (
          <div className={`flex overflow-auto`} style={settings.sidebarVisible === 'end' ? { width: '100%' } : { width: settings.sidebarWidth }}>
            <Sidebar courseOps={courseOps} user={user} learningSession={learningSession} editorVisible={editorVisible} />
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
