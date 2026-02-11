import React from 'react';

export default function EmbeddedInstruction({ learningSession }) {
  return <iframe className="w-full h-full" src={learningSession.topic?.path} title="Embedded content" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />;
}
