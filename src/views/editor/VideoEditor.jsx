import React from 'react';
import VideoInstruction from '../instruction/videoInstruction';

export default function VideoEditor({ currentTopic }) {
  return (
    <>
      <div className="p-2 border-b border-gray-200 text-sm text-gray-500">
        <strong>URL</strong> {currentTopic?.path || ''}
      </div>
      <VideoInstruction topic={currentTopic} />
    </>
  );
}
