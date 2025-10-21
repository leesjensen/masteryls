import React from 'react';
import useProgressTracking from '../../hooks/useProgressTracking';

export default function VideoInstruction({ topic, courseOps }) {
  const { recordProgress } = useProgressTracking({
    activityId: topic?.id,
    activityType: 'video_view',
    onProgress: courseOps?.addProgress,
    enabled: !!topic?.path && !!courseOps?.addProgress,
    minDuration: 10,
    dependencies: [topic?.path],
  });

  // In a real implementation, you might want to track actual video events
  const handleVideoPlay = () => {
    resumeTracking();
  };

  const handleVideoPause = () => {
    pauseTracking();
  };

  return <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${extractYouTubeId(topic.path)}`} title="YouTube video player" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen onPause={handleVideoPause} onPlay={handleVideoPlay} />;

  function extractYouTubeId(url) {
    const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const match = url.match(regExp);
    return match ? match[1] : '';
  }
}
