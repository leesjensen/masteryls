import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import TopicItem from './TopicItem';
import { TopicIcon } from './TopicIcon';

export function EditableTopicItem({ id, moduleIndex, topicIndex, onRemoveTopic, onRenameTopic, topic, ...props }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const [editingTopic, setEditingTopic] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState(topic?.title || '');
  const [newType, setNewType] = React.useState(topic?.type || 'instruction');

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleRename = () => {
    if (newTitle.trim() && onRenameTopic) {
      onRenameTopic(moduleIndex, topicIndex, newTitle.trim(), newType);
      setEditingTopic(false);
    }
  };

  const handleCancel = () => {
    setNewTitle(topic?.title || '');
    setNewType(topic?.type || 'instruction');
    setEditingTopic(false);
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} className={isDragging ? 'opacity-50' : ''}>
      <div className="flex items-right justify-between">
        <div className="flex flex-row flex-1 items-center">
          {editingTopic ? (
            <div className="flex flex-row items-center justify-between">
              <div className="mr-2">
                <select value={newType} onChange={(e) => setNewType(e.target.value)} className="appearance-none px-2 bg-transparent border-3 border-sky-600 rounded-sm text-xs cursor-pointer" title="Change topic type">
                  <option value="instruction">i</option>
                  <option value="video">v</option>
                  <option value="quiz">q</option>
                  <option value="project">p</option>
                </select>
              </div>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="px-1 py-0.5 border rounded text-xs w-28 mr-1"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename();
                  if (e.key === 'Escape') handleCancel();
                }}
              />
              <button onClick={handleRename} className="text-blue-600 px-1 text-xs" title="Save" disabled={!newTitle.trim()}>
                ✓
              </button>
              <button onClick={handleCancel} className="text-gray-400 px-1 text-xs" title="Cancel">
                ✗
              </button>
            </div>
          ) : (
            <TopicItem {...props} topic={topic} />
          )}
        </div>
        <div className="flex flex-row justify-between items-center">
          {!editingTopic && (
            <button onClick={() => setEditingTopic(true)} className="font-semibold text-gray-400 hover:text-blue-600 border-1 px-1 border-gray-300" title="Edit this topic">
              e
            </button>
          )}
          <button onClick={() => onRemoveTopic(moduleIndex, topicIndex)} className="font-semibold text-gray-400 hover:text-red-600 border-1 px-1 border-gray-300" title="Remove this topic">
            x
          </button>
          <span {...listeners} className="select-none font-semibold text-gray-400 hover:text-amber-500 border-1 px-1 border-gray-300" title="Drag to reorder">
            ≡
          </span>
        </div>
      </div>
    </div>
  );
}
