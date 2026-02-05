import React, { use, useState } from 'react';
import { X } from 'lucide-react';
import Toolbar from './toolbar.jsx';
import Sidebar from './sidebar.jsx';
import Instruction from '../../components/instruction/instruction.jsx';
import Editor from '../../components/editor/editor.jsx';
import Splitter from '../../components/Splitter.jsx';
import { updateAppBar } from '../../hooks/useAppBarState.jsx';
import { AppBarButton } from '../../appBar.jsx';
import { useNavigate } from 'react-router-dom';

export default function ClassroomView({ courseOps, user, learningSession, settings }) {
  const [editorVisible, setEditorVisible] = useState(false);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (learningSession.course) {
      const url = user ? `/dashboard` : `/`;
      const appBarTools = <AppBarButton icon={X} onClick={() => navigate(url)} title="Close" />;

      updateAppBar({ title: learningSession.course?.title, subTitle: learningSession?.topic?.title, tools: appBarTools });
    }
  }, [learningSession]);

  function handleSplitterResize(newWidth) {
    const minSidebarWidth = 150;
    const maxSidebarWidth = Math.max(minSidebarWidth, window.innerWidth - minSidebarWidth);

    if (newWidth <= minSidebarWidth) {
      courseOps.saveEnrollmentUiSettings(learningSession.course.id, { sidebarVisible: 'start' });
    } else if (newWidth >= maxSidebarWidth) {
      courseOps.saveEnrollmentUiSettings(learningSession.course.id, { sidebarVisible: 'end' });
    } else {
      courseOps.saveEnrollmentUiSettings(learningSession.course.id, { sidebarVisible: 'split', sidebarWidth: newWidth });
    }
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
          <div className={`flex overflow-auto`} style={settings.sidebarVisible === 'end' ? { width: '100%' } : { width: settings.sidebarWidth }}>
            <Sidebar courseOps={courseOps} user={user} learningSession={learningSession} editorVisible={editorVisible} />
          </div>
        )}
        {settings.sidebarVisible === 'split' && <Splitter onResize={handleSplitterResize} minPosition={150} maxPosition={window.innerWidth - 150} />}
        {settings.sidebarVisible !== 'end' && (
          <div id="content" className={`flex flex-1 h-full overflow-auto`}>
            {content}
          </div>
        )}
      </main>
    </>
  );
}
