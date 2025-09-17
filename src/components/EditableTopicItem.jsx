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
          <div className="ml-2 flex items-center">
            <button onClick={() => onRemoveTopic(moduleIndex, topicIndex)} className="pr-2 font-semibold  text-gray-400 hover:text-red-600" title="Remove this topic">
              x
            </button>
          </div>
          <span {...listeners} className="mr-2 select-none font-semibold text-gray-400 hover:text-amber-500 border-[1px] px-1 border-gray-300" title="Drag to reorder">
            ≡
          </span>
        </div>
      </div>
    </div>
  );
}
