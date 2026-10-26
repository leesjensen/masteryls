import React from 'react';
import { SquarePen, X, ChevronDown, ChevronRight } from 'lucide-react';
import { EditableTopicItem } from './EditableTopicItem';
import { useNavigate } from 'react-router-dom';
import TopicItem from './TopicItem';
import NewTopicButton from './NewTopicButton';
import useClickOutside from '../hooks/useClickOutside';
import ConfirmDialog from '../hooks/confirmDialog.jsx';
import Button from './ui/Button.jsx';
import Input from './ui/Input.jsx';

function ModuleSection({ courseOps, learningSession, module, moduleIndex, isOpen, onToggle, currentTopic, editorVisible, dueDatesByTopicId = {}, topicStatusByTopicId = {}, currentTopicHeadings = [] }) {
  const editorRef = React.useRef(null);
  const [showEditForm, setShowEditForm] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState(module.title || '');
  const dialogRef = React.useRef(null);
  const navigate = useNavigate();

  React.useEffect(() => {
    setNewTitle(module.title || '');
  }, [module.title]);

  // Surface the schedule's today/next highlight on the module heading too, so a collapsed module
  // still signals it holds a topic covered now or next. 'today' wins over 'next'.
  const moduleStatus = React.useMemo(() => {
    let status = '';
    for (const topic of module.topics || []) {
      const topicStatus = topicStatusByTopicId[topic.id];
      if (topicStatus === 'today') {
        return 'today';
      }
      if (topicStatus === 'next') {
        status = 'next';
      }
    }
    return status;
  }, [module.topics, topicStatusByTopicId]);

  const moduleTitleAccent = moduleStatus === 'today' ? 'text-orange-500 font-bold' : moduleStatus === 'next' ? 'text-blue-500 font-bold' : 'text-gray-500 font-semibold';

  useClickOutside(editorRef, () => {
    setShowEditForm(false);
    setNewTitle(module.title || '');
  });

  async function handleSubmitRename() {
    if (!newTitle || !newTitle.trim()) return;
    try {
      await courseOps.renameModule(moduleIndex, newTitle.trim());
    } catch (err) {
      console.error('rename module failed', err);
    }
    setShowEditForm(false);
  }

  async function handleRemoveModule() {
    try {
      if (dialogRef.current && dialogRef.current.close) dialogRef.current.close();
      await courseOps.removeModule(moduleIndex);

      // If the removed module was the current module, navigate to the default topic
      if (currentTopic?.path && module.topics.some((t) => t.path === currentTopic.path)) {
        navigate(`/course/${learningSession.course.id}/topic/${learningSession.course.defaultTopic().id}`);
      }
    } catch (err) {
      console.error('remove module failed', err);
    }
  }

  function getTopicItem(topic, topicIndex) {
    const dueDateLabel = dueDatesByTopicId[topic.id] || '';
    const scheduleStatus = topicStatusByTopicId[topic.id] || '';
    if (editorVisible) {
      return <EditableTopicItem key={topic.id} id={topic.id} courseOps={courseOps} course={learningSession.course} topic={topic} topicIndex={topicIndex} moduleIndex={moduleIndex} currentTopic={currentTopic} editorVisible={editorVisible} dueDateLabel={dueDateLabel} scheduleStatus={scheduleStatus} />;
    }
    const headings = topic.id === currentTopic?.id ? currentTopicHeadings : [];
    return <TopicItem key={topic.id} course={learningSession.course} topic={topic} currentTopic={currentTopic} enrollment={learningSession.enrollment} courseOps={courseOps} dueDateLabel={dueDateLabel} scheduleStatus={scheduleStatus} headings={headings} />;
  }

  return (
    <div>
      <li className="mb-1">
        <div className="flex items-center justify-between gap-1 min-w-0">
          <button onClick={() => onToggle(moduleIndex)} className={`no-underline ${moduleTitleAccent} bg-transparent border-none cursor-pointer p-0 flex flex-1 min-w-0 whitespace-nowrap overflow-hidden items-center`} aria-expanded={isOpen} title={module.title}>
            <span className="mr-2 shrink-0" aria-hidden="true">{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
            <span className="truncate min-w-0">{module.title}</span>
          </button>
          {editorVisible && (
            <div className="flex items-center justify-end shrink-0 w-9">
              <button onClick={() => setShowEditForm(true)} className="font-semibold text-gray-400 hover:text-blue-600 p-0.5 text-[6pt]" title="Edit this module">
                <SquarePen size={12} />
              </button>
              <button onClick={() => dialogRef.current.showModal()} className="font-semibold text-gray-400 hover:text-red-600 p-0.5" title="Remove this module">
                <X size={12} />
              </button>
            </div>
          )}
        </div>

        {showEditForm && (
          <div ref={editorRef} className="mt-1 mb-1 p-2 bg-gray-50 border rounded">
            <Input size="sm" type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} autoFocus />
            <div className="mt-2 flex gap-2">
              <Button size="xs" onClick={handleSubmitRename}>
                Save
              </Button>
              <Button
                size="xs"
                variant="secondary"
                onClick={() => {
                  setShowEditForm(false);
                  setNewTitle(module.title || '');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {isOpen && (
          <ul className="list-none p-0 ml-4">
            {module.topics.map((topic, topicIndex) => getTopicItem(topic, topicIndex))}
            {editorVisible && (
              <li className="mb-0.5 flex items-center">
                <NewTopicButton moduleIndex={moduleIndex} courseOps={courseOps} />
              </li>
            )}
          </ul>
        )}
        <ConfirmDialog
          dialogRef={dialogRef}
          title="Delete module"
          confirmed={handleRemoveModule}
          message={
            <p>
              Are you sure you want to delete the module <b>{module.title}</b>?
            </p>
          }
          confirmButtonText="Delete"
        />
      </li>
    </div>
  );
}

export default ModuleSection;
