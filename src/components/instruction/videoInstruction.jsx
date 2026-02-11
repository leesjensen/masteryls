import React from 'react';

export default function VideoInstruction({ learningSession, courseOps }) {
  return <iframe className="w-full h-full" src={learningSession.topic?.path} title="YouTube video player" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />;
}
