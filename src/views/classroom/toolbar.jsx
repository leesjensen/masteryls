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

  function displaySchedule() {
    courseOps.setSidebarVisible('start');
    navigate(`/course/${learningSession.course.id}/topic/${learningSession.course.schedule}`);
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
        {user && user.isEditor(learningSession.course.id) && (
          <button title="Edit/View topic" className="hover:text-amber-600 transition-all duration-200 ease-in-out" onClick={() => toggleEditor()}>
            {editing ? <File size={20} /> : <FilePenLine size={20} />}
          </button>
        )}
        {user && user.isEditor(learningSession.course.id) && learningSession.topic?.externalRefs?.canvasPageId && learningSession.course?.externalRefs?.canvasCourseId && (
          <button title="Export topic" className="hover:text-amber-600 transition-all duration-200 ease-in-out" onClick={() => updateCanvasPage()}>
            <FileDown size={20} />
          </button>
        )}
        {learningSession.course.links?.chat && (
          <button title="Course chat server" className="hover:text-amber-600 transition-all duration-200 ease-in-out" onClick={() => window.open(learningSession.course.links.chat, '_blank')}>
            <MessageCircleQuestionMark size={20} />
          </button>
        )}
        {learningSession.course.externalRefs?.canvasCourseId && learningSession.topic.externalRefs?.canvasPageId && (
          <button title="Canvas course site" className="hover:text-amber-600 transition-all duration-200 ease-in-out flex items-center justify-center filter grayscale hover:grayscale-0" onClick={() => window.open(`https://byu.instructure.com/courses/${learningSession.course.externalRefs.canvasCourseId}/pages/${learningSession.topic.externalRefs.canvasPageId}`, '_blank')}>
            <Canvas size={20} />
          </button>
        )}
        <button title="GitHub repository" className="hover:text-amber-600 transition-all duration-200 ease-in-out flex items-center justify-center filter grayscale hover:grayscale-0" onClick={() => window.open(gitHubUrl(learningSession.topic.path), '_blank')}>
          <GitHub size={20} color="#faa400" />
        </button>
        <button title="Previous topic" className="hover:text-amber-600 transition-all duration-200 ease-in-out" onClick={() => navigateToTopic('prev')}>
          <SquareChevronLeft size={20} />
        </button>
        <button title="Next topic" className="hover:text-amber-600 transition-all duration-200 ease-in-out" onClick={() => navigateToTopic('next')}>
          <SquareChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
