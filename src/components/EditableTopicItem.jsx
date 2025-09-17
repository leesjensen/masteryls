import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import TopicItem from './TopicItem';

export function EditableTopicItem({ id, moduleIndex, topicIndex, onRemoveTopic, ...props }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Render a drag handle separate from the clickable topic
  return (
    <div ref={setNodeRef} style={style} {...attributes} className={isDragging ? 'opacity-50' : ''}>
      <div className="flex items-right justify-between">
        <TopicItem {...props} />
        <div className="flex flex-row justify-between">
          <button onClick={() => onRenameTopic(moduleIndex, topicIndex)} className="font-semibold  text-gray-400 hover:text-blue-600 border-1 px-1 border-gray-300" title="Edit this topic">
            e
          </button>
          <button onClick={() => onRemoveTopic(moduleIndex, topicIndex)} className="font-semibold  text-gray-400 hover:text-red-600 border-1 px-1 border-gray-300" title="Remove this topic">
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
