import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import TopicItem from './TopicItem';

export function SortableTopicItem({ id, ...props }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Render a drag handle separate from the clickable topic
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span {...listeners} style={{ cursor: 'grab', marginRight: 8, userSelect: 'none' }} title="Drag to reorder">
          ≡
        </span>
        <TopicItem {...props} />
      </div>
    </div>
  );
}
