import React from 'react';
import { Menu, FileDown, File, FilePenLine, MessageCircleQuestionMark, SquareChevronRight, SquareChevronLeft } from 'lucide-react';
import { GitHub, Canvas } from '../../utils/Icons.jsx';
import { useNavigate } from 'react-router-dom';
import { useAlert } from '../../contexts/AlertContext.jsx';

export default function Toolbar({ courseOps, user, learningSession, settings, editing, toggleEditor }) {
  const navigate = useNavigate();
  const { showAlert } = useAlert();

  function gitHubUrl(url) {
    return url.replace(learningSession.course.links.gitHub.rawUrl, learningSession.course.links.gitHub.url);
  }

  function getNextWindowState() {
    if (window.innerWidth < 400) {
      return settings.sidebarVisible === 'end' ? 'start' : 'end';
    }
    return settings.sidebarVisible === 'start' ? 'split' : settings.sidebarVisible === 'end' ? 'split' : 'start';
  }

  function navigateToTopic(direction) {
    const newTopic = courseOps.getAdjacentTopic(direction);
    if (newTopic) {
      navigate(`/course/${learningSession.course.id}/topic/${newTopic.id}`);
    }
  }

  async function updateCanvasPage() {
    await courseOps.updateCanvasPage(learningSession.course, learningSession.topic, learningSession.course.externalRefs.canvasCourseId);
    showAlert({ message: `${learningSession.topic.title} exported successfully`, type: 'info' });
  }

  const nextSidebarState = getNextWindowState();

  return (
    <div className="flex flex-row justify-between border-b-1 border-gray-200">
      <div className="flex flex-row justify-start">
        <button className="flex gap-1 w-12 m-1 p-1.5 text-xs font-medium  hover:text-amber-600 transition-all duration-200 ease-in-out" onClick={() => courseOps.setSidebarVisible(nextSidebarState)}>
          <Menu size={16} />
          {settings.sidebarVisible !== 'start' ? '◀' : '▶'}
        </button>
      </div>
      <div className="flex flex-row justify-end gap-2 items-center pr-2">
        {user && user.isEditor(learningSession.course.id) && <ToolBarButton title="Edit/View topic" onClick={() => toggleEditor()} icon={editing ? File : FilePenLine} />}
        {user && user.isEditor(learningSession.course.id) && learningSession.topic?.externalRefs?.canvasPageId && learningSession.course?.externalRefs?.canvasCourseId && <ToolBarButton title="Export topic" onClick={() => updateCanvasPage()} icon={FileDown} />}
        {learningSession.course.links?.chat && <ToolBarButton title="Course chat server" onClick={() => window.open(learningSession.course.links.chat, '_blank')} icon={MessageCircleQuestionMark} />}
        {learningSession.course.externalRefs?.canvasCourseId && learningSession.topic.externalRefs?.canvasPageId && <ToolBarButton title="Canvas course site" onClick={() => window.open(`https://byu.instructure.com/courses/${learningSession.course.externalRefs.canvasCourseId}/pages/${learningSession.topic.externalRefs.canvasPageId}`, '_blank')} icon={Canvas} />}
        <ToolBarButton title="GitHub repository" onClick={() => window.open(gitHubUrl(learningSession.topic.path), '_blank')} icon={GitHub} />
        <ToolBarButton title="Previous topic" onClick={() => navigateToTopic('prev')} icon={SquareChevronLeft} />
        <ToolBarButton title="Next topic" onClick={() => navigateToTopic('next')} icon={SquareChevronRight} />
      </div>
    </div>
  );
}

export function ToolBarButton({ icon: Icon, onClick, title = undefined, size = 18 }) {
  return (
    <button title={title} onClick={onClick} className=" hover:text-amber-600 transition-all duration-200 ease-in-out  filter grayscale hover:grayscale-0">
      <Icon size={size} />
    </button>
  );
}
