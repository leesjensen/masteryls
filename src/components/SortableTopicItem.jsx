import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import TopicItem from './TopicItem';

export function SortableTopicItem({ id, ...props }) {
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
        <span {...listeners} className="cursor-grab mr-2 select-none text-gray-400 hover:text-amber-500" title="Drag to reorder">
          ≡
        </span>
      </div>
    </div>
  );
}
