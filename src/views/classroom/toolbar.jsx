import React from 'react';
import { FileDown, SquareChevronRight, SquareChevronLeft, CalendarDays, ChartArea, ArrowLeftFromLine, ArrowRightFromLine } from 'lucide-react';
import { GitHub, Canvas } from '../../utils/Icons.jsx';
import { useNavigate } from 'react-router-dom';
import { useAlert } from '../../contexts/AlertContext.jsx';
import { getCanvasTopicUrl, getCanvasCourseUrl, hasCanvasTopicLink } from '../../hooks/canvas/canvasSync.js';
import MasteryPie from '../../components/MasteryPie.jsx';

export default function Toolbar({ courseOps, user, learningSession, settings, editing, toggleEditor }) {
  const navigate = useNavigate();
  const { showAlert } = useAlert();

  function gitHubUrl(url) {
    return url.replace(learningSession.course.links.gitHub.rawUrl, learningSession.course.links.gitHub.url);
  }

  function navigateToTopic(direction) {
    const newTopic = courseOps.getAdjacentTopic(direction);
    if (newTopic) {
      navigate(`/course/${learningSession.course.id}/topic/${newTopic.id}`);
    }
  }

  function navigateToSchedule() {
    navigate(`/course/${learningSession.course.id}/schedule`);
  }

  function navigateToMasteryView() {
    const courseId = learningSession.course.id;
    if (user && !user.isRoot() && !user.isEditor(courseId)) {
      navigate(`/masteryview/learner/${user.id}/course/${courseId}`);
    } else {
      navigate(`/masteryview/course/${courseId}`);
    }
  }

  async function linkCanvasTopic() {
    await courseOps.updateCanvasPage(learningSession.course, learningSession.topic, learningSession.course.externalRefs.canvasCourseId);
    showAlert({ message: `${learningSession.topic.title} linked successfully`, type: 'info' });
  }

  const canvasCourseId = learningSession.course?.externalRefs?.canvasCourseId;
  const canvasTopicUrl = getCanvasTopicUrl(canvasCourseId, learningSession.topic);
  // Link to the topic when it is individually linked, otherwise the Canvas course page.
  const canvasUrl = canvasTopicUrl || getCanvasCourseUrl(canvasCourseId);
  const isObserveReadOnly = Boolean(learningSession?.observeMode);
  const masteryPercent = learningSession?.enrollment?.progress?.mastery;
  const hasMastery = Number.isFinite(Number(masteryPercent));

  return (
    <div className="flex flex-row justify-between border-b-1 border-gray-200">
      <div className="flex gap-1 w-12 m-1 p-1.5 text-xs font-medium items-center hover:text-amber-600 transition-all duration-200 ease-in-out" onClick={() => courseOps.toggleSidebar()}>
        {settings.sidebarVisible !== 'start' ? <ToolBarButton icon={ArrowLeftFromLine} title="Collapse sidebar" size={16} aria-hidden="true" /> : <ToolBarButton icon={ArrowRightFromLine} title="Expand sidebar" size={16} aria-hidden="true" />}
      </div>
      <div className="flex flex-row justify-end gap-2 items-center pr-2">
        {user && user.isEditor(learningSession.course.id) && !isObserveReadOnly && <EditorToggleSlider editing={editing} onToggle={toggleEditor} />}
        {user && user.isEditor(learningSession.course.id) && !isObserveReadOnly && hasCanvasTopicLink(learningSession.topic) && learningSession.course?.externalRefs?.canvasCourseId && <ToolBarButton title="Link topic" onClick={() => linkCanvasTopic()} icon={FileDown} />}
        {canvasCourseId && <ToolBarButton title={courseOps.canSubmitToCanvasGradebook ? 'Canvas — your grades submit here' : canvasTopicUrl ? 'Canvas topic' : 'Canvas course site'} onClick={() => window.open(canvasUrl, '_blank')} icon={Canvas} badge={courseOps.canSubmitToCanvasGradebook} />}
        {courseOps.getScheduleTopic(learningSession.course) && <ToolBarButton title="Schedule" onClick={navigateToSchedule} icon={CalendarDays} />}
        <ToolBarButton title="GitHub repository" onClick={() => window.open(gitHubUrl(learningSession.topic.path), '_blank')} icon={GitHub} />
        {hasMastery ? <MasteryPie percent={masteryPercent} title={`Mastery ${Math.round(Number(masteryPercent))}% — open MasteryView`} onClick={navigateToMasteryView} /> : <ToolBarButton title="MasteryView" onClick={navigateToMasteryView} icon={ChartArea} />}
        <ToolBarButton title="Previous topic" onClick={() => navigateToTopic('prev')} icon={SquareChevronLeft} />
        <ToolBarButton title="Next topic" onClick={() => navigateToTopic('next')} icon={SquareChevronRight} />
      </div>
    </div>
  );
}

export function ToolBarButton({ icon: Icon, onClick, title = undefined, size = 24, badge = false }) {
  return (
    <span className="relative inline-flex">
      <button title={title} onClick={onClick} className=" hover:text-amber-600 transition-all duration-200 ease-in-out  filter grayscale hover:grayscale-0">
        <Icon size={size} />
      </button>
      {/* Status dot rendered outside the grayscale-filtered button so it stays colored. */}
      {badge && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-500 ring-1 ring-white pointer-events-none" aria-hidden="true" />}
    </span>
  );
}

export function EditorToggleSlider({ editing, onToggle }) {
  return (
    <label className="relative inline-flex items-center w-14 h-6 cursor-pointer rounded-full bg-gray-300 hover:bg-gray-400 transition-colors" title={editing ? 'Switch to View mode' : 'Switch to Edit mode'}>
      <input id="editor-toggle" type="checkbox" checked={editing} onChange={onToggle} className="opacity-0 w-0 h-0 peer" />
      <span className="absolute inset-0 border border-gray-100 bg-gray-400 rounded-full transition-all duration-300 ease-in-out peer-checked:bg-blue-400 peer-hover:bg-gray-600 peer-checked:peer-hover:bg-blue-600"></span>
      <span className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full transition-all duration-300 ease-in-out peer-checked:translate-x-8 shadow-sm"></span>
      <span className={`absolute top-0 h-full flex items-center text-[12px] font-semibold text-white pointer-events-none z-10 ${editing ? 'left-1.5' : 'right-1.5'}`}>{editing ? 'Edit' : 'View'}</span>
    </label>
  );
}
