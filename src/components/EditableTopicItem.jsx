import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import TopicItem from './TopicItem';
import TopicForm from './TopicForm';
import useClickOutside from '../hooks/useClickOutside';

/**
 * EditableTopicItem is a draggable and editable topic item component for a module.
 * Allows renaming, changing type, and removing a topic, with inline editing UI.
 *
 * @component
 * @param {Object} props - Component props.
 * @param {Object} props.courseOps - Course operations object containing methods for topic management.
 * @param {string|number} props.id - Unique identifier for the sortable item.
 * @param {number} props.moduleIndex - Index of the parent module.
 * @param {number} props.topicIndex - Index of the topic within the module.
 * @param {Object} props.topic - Topic data object for this item, should contain at least `title`, `type`, and `state`.
 * @param {Object} props.currentTopic - Currently selected/active topic object.
 */
export function EditableTopicItem({ courseOps, id, moduleIndex, topicIndex, topic, currentTopic }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const editorRef = React.useRef(null);
  const [showEditForm, setShowEditForm] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  async function handleSubmitForm(title, description, type) {
    setIsLoading(true);
    try {
      if (topic.state === 'stub') {
        await courseOps.generateTopic(topic, description);
        setShowEditForm(false);
      } else {
        courseOps.renameTopic(moduleIndex, topicIndex, title, description, type);
        setShowEditForm(false);
      }
    } catch (error) {
      console.error('Error adding topic:', error);
    } finally {
      setIsLoading(false);
    }
  }

  useClickOutside(editorRef, () => {
    setShowEditForm(false);
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} className={isDragging ? 'opacity-50' : ''}>
      <div className="flex items-right justify-between">
        <div className="flex flex-row flex-1 items-center">
          <div className="flex flex-col">
            <TopicItem courseOps={courseOps} topic={topic} currentTopic={currentTopic} />
            {showEditForm && (
              <div ref={editorRef}>
                <TopicForm topic={topic} onSubmit={handleSubmitForm} onCancel={() => setShowEditForm(false)} isLoading={isLoading} />
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-row justify-between items-center">
          <button onClick={() => setShowEditForm(true)} className="font-semibold text-gray-400 hover:text-blue-600  pr-1" title="Edit this topic">
            e
          </button>
          <button onClick={() => courseOps.removeTopic(moduleIndex, topicIndex)} className="font-semibold text-gray-400 hover:text-red-600  pr-1" title="Remove this topic">
            x
          </button>
          <span {...listeners} className="select-none font-semibold text-gray-400 hover:text-amber-500  pr-1" title="Drag to reorder">
            ≡
          </span>
        </div>
      </div>
    </div>
  );
}
