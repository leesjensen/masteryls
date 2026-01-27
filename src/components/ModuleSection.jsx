import React from 'react';
import { SquarePen, Delete } from 'lucide-react';
import { EditableTopicItem } from './EditableTopicItem';
import { useNavigate } from 'react-router-dom';
import TopicItem from './TopicItem';
import NewTopicButton from './NewTopicButton';
import useClickOutside from '../hooks/useClickOutside';
import ConfirmDialog from '../hooks/confirmDialog.jsx';

function ModuleSection({ courseOps, learningSession, module, moduleIndex, isOpen, onToggle, currentTopic, editorVisible }) {
  const editorRef = React.useRef(null);
  const [showEditForm, setShowEditForm] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState(module.title || '');
  const dialogRef = React.useRef(null);
  const navigate = useNavigate();

  React.useEffect(() => {
    setNewTitle(module.title || '');
  }, [module.title]);

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
    if (editorVisible) {
      return <EditableTopicItem key={topic.id} id={topic.id} courseOps={courseOps} course={learningSession.course} topic={topic} topicIndex={topicIndex} moduleIndex={moduleIndex} currentTopic={currentTopic} editorVisible={editorVisible} />;
    }
    return <TopicItem key={topic.id} course={learningSession.course} topic={topic} currentTopic={currentTopic} enrollment={learningSession.enrollment} />;
  }

  return (
    <div>
      <li className="mb-1">
        <div className="flex items-center justify-between">
          <button onClick={() => onToggle(moduleIndex)} className="no-underline text-gray-500 font-semibold bg-transparent border-none cursor-pointer p-0 truncate max-w-full flex whitespace-nowrap overflow-hidden text-ellipsis items-center" aria-expanded={isOpen} title={module.title}>
            <span className="mr-2">{isOpen ? '▼' : '▶'}</span>
            {module.title}
          </button>
          {editorVisible && (
            <div className="flex items-center">
              <button onClick={() => setShowEditForm(true)} className="font-semibold text-gray-400 hover:text-blue-600 pr-1  text-[6pt]" title="Edit this module">
                <SquarePen size={12} />
              </button>
              <button onClick={() => dialogRef.current.showModal()} className="font-semibold text-gray-400 hover:text-red-600 pr-1" title="Remove this module">
                <Delete size={12} />
              </button>
            </div>
          )}
        </div>

        {showEditForm && (
          <div ref={editorRef} className="mt-1 mb-1 p-2 bg-gray-50 border rounded">
            <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="px-2 py-1 border rounded text-sm w-full" autoFocus />
            <div className="mt-2 flex gap-2">
              <button onClick={handleSubmitRename} className="px-2 py-1 bg-blue-600 text-white rounded text-xs">
                Save
              </button>
              <button
                onClick={() => {
                  setShowEditForm(false);
                  setNewTitle(module.title || '');
                }}
                className="px-2 py-1 bg-gray-600 text-white rounded text-xs"
              >
                Cancel
              </button>
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
