import React from 'react';

export default function VideoInstruction({ learningSession, courseOps }) {
  return <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${extractYouTubeId(learningSession.topic?.path)}?cb=${Date.now()}`} title="YouTube video player" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />;

  function extractYouTubeId(url) {
    const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const match = url.match(regExp);
    return match ? match[1] : '';
  }
}
