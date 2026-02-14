import React, { use, useState } from 'react';
import Toolbar from './toolbar.jsx';
import Sidebar from './sidebar.jsx';
import Instruction from '../../components/instruction/instruction.jsx';
import Editor from '../../components/editor/editor.jsx';
import Splitter from '../../components/Splitter.jsx';
import { updateAppBar } from '../../hooks/useAppBarState.jsx';
import { useNavigate } from 'react-router-dom';
import useHotkeys from '../../hooks/useHotKeys';

export default function ClassroomView({ courseOps, user, learningSession, settings }) {
  const [editorVisible, setEditorVisible] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(settings.sidebarWidth || 300);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (learningSession.course) {
      updateAppBar({ title: learningSession.course?.title, subTitle: learningSession?.topic?.title });
    }
  }, [learningSession]);

  useHotkeys(
    {
      'meta+ArrowRight': (e) => {
        navigateToTopic('next');
      },
      'meta+ArrowLeft': (e) => {
        navigateToTopic('prev');
      },
      'meta+b': (e) => {
        courseOps.toggleSidebar();
      },
    },
    { target: undefined },
  );

  function navigateToTopic(direction) {
    const newTopic = courseOps.getAdjacentTopic(direction);
    if (newTopic) {
      navigate(`/course/${learningSession.course.id}/topic/${newTopic.id}`);
    }
  }

  function sidebarResized(xPosition) {
    courseOps.saveEnrollmentUiSettings(learningSession.course.id, { sidebarVisible: 'split', sidebarWidth: xPosition });
    setSidebarWidth(xPosition);
  }

  function sidebarMoved(xPosition) {
    setSidebarWidth(xPosition);
  }

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
          <div className={`flex overflow-auto`} style={settings.sidebarVisible === 'end' ? { width: '100%' } : { width: sidebarWidth }}>
            <Sidebar courseOps={courseOps} user={user} learningSession={learningSession} editorVisible={editorVisible} />
          </div>
        )}
        {settings.sidebarVisible === 'split' && <Splitter onMove={sidebarMoved} onResized={sidebarResized} minPosition={150} maxPosition={window.innerWidth - 150} />}
        {settings.sidebarVisible !== 'end' && (
          <div id="content" className={`flex flex-1 h-full overflow-auto`}>
            {content}
          </div>
        )}
      </main>
    </>
  );
}
