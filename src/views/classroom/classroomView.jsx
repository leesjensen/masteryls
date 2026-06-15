import React, { use, useState, useEffect } from 'react';
import Toolbar from './toolbar.jsx';
import Sidebar from './sidebar.jsx';
import Instruction from '../../components/instruction/instruction.jsx';
import Editor from '../../components/editor/editor.jsx';
import Splitter from '../../components/Splitter.jsx';
import { updateAppBar } from '../../hooks/useAppBarState.jsx';
import { useNavigate } from 'react-router-dom';
import useHotkeys from '../../hooks/useHotKeys';

export default function ClassroomView({ courseOps, user, learningSession, settings, onExitObserve = null, observedLearnerName = '' }) {
  const [editorVisible, setEditorVisible] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(settings.sidebarWidth || 300);
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false));
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (event) => setIsMobile(event.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const effectiveSidebarVisible = isMobile && settings.sidebarVisible !== 'start' ? 'end' : settings.sidebarVisible;
  const scheduleFiles = learningSession?.topic?.type === 'schedule' ? courseOps.getScheduleFiles(learningSession.topic) : [];
  const selectedScheduleFile = learningSession?.topic?.type === 'schedule' ? courseOps.getSelectedScheduleFile(learningSession.topic, scheduleFiles) : null;
  const appBarSubTitle = selectedScheduleFile?.title || learningSession?.topic?.title;

  React.useEffect(() => {
    if (learningSession.course) {
      updateAppBar({ title: learningSession.course?.title, subTitle: appBarSubTitle });
    }
  }, [learningSession, appBarSubTitle]);

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
      'meta+i': () => {
        courseOps.toggleDiscussion();
      },
      'ctrl+i': () => {
        courseOps.toggleDiscussion();
      },
    },
    { target: undefined, allowInInputs: ['meta+i', 'ctrl+i'] },
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
      {learningSession?.observeMode && (
        <div className="px-4 py-2 text-sm bg-amber-50 text-amber-800 border-b border-amber-200 flex items-center justify-between gap-2">
          <span>
            Observe mode is active for <b>{observedLearnerName || 'this learner'}</b>. Actions are read-only.
          </span>
          {typeof onExitObserve === 'function' && (
            <button type="button" onClick={onExitObserve} className="px-2 py-1 rounded border border-amber-400 bg-white text-amber-800 hover:bg-amber-100 text-xs">
              Exit observe
            </button>
          )}
        </div>
      )}

      <main className="flex flex-1 overflow-hidden">
        {effectiveSidebarVisible !== 'start' && (
          <div className={`flex overflow-auto`} style={effectiveSidebarVisible === 'end' ? { width: '100%' } : { width: sidebarWidth }}>
            <Sidebar courseOps={courseOps} user={user} learningSession={learningSession} editorVisible={editorVisible} />
          </div>
        )}
        {effectiveSidebarVisible === 'split' && <Splitter onMove={sidebarMoved} onResized={sidebarResized} minPosition={150} maxPosition={window.innerWidth - 150} />}
        {effectiveSidebarVisible !== 'end' && (
          <div id="content" className={`flex flex-1 h-full overflow-auto`}>
            {content}
          </div>
        )}
      </main>
    </>
  );
}
