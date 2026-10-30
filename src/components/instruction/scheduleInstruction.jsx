import React from 'react';
import InteractionInstruction from './interaction/interactionInstruction';
import { delimitScheduleTopLinks } from '../../utils/scheduleMarkdown';

export default function ScheduleInstruction({ courseOps, learningSession, user, instructionState = 'learning' }) {
  const [files, setFiles] = React.useState([]);
  const [selectedFileId, setSelectedFileId] = React.useState('');
  const [content, setContent] = React.useState('');

  React.useEffect(() => {
    const topic = learningSession?.topic;
    if (!topic || topic.type !== 'schedule') {
      return;
    }

    const scheduleFiles = courseOps.getScheduleFiles(topic);
    setFiles(scheduleFiles);

    const selected = courseOps.getSelectedScheduleFile(topic, scheduleFiles);
    setSelectedFileId(selected?.id || '');
  }, [learningSession?.topic]);

  React.useEffect(() => {
    const topic = learningSession?.topic;
    if (!topic || topic.type !== 'schedule') {
      return;
    }

    if (!selectedFileId) {
      return;
    }

    // Guard against out-of-order resolution: if selectedFileId changes again before this
    // fetch resolves (e.g. a rapid re-selection, or the file-picker effect above settling
    // through more than one value), a slower older request must not overwrite the content
    // a newer request already applied.
    let cancelled = false;
    courseOps.getScheduleTopicContent(topic, selectedFileId).then((markdown) => {
      if (cancelled) return;
      // Display-time only: delimit the adjacent top-of-schedule links so they read as distinct links.
      setContent(delimitScheduleTopLinks(markdown || ''));
    });
    return () => {
      cancelled = true;
    };
  }, [selectedFileId, learningSession?.topic]);

  function handleSelectionChange(event) {
    const fileId = event.target.value;
    setSelectedFileId(fileId);
    courseOps.setSelectedScheduleFile(learningSession.topic, fileId);
  }

  return (
    <div className="h-full w-full min-h-0 min-w-0 flex flex-col">
      {files.length > 1 && (
        <div className="flex justify-end px-4 py-2 border-b border-gray-200 bg-gray-50">
          <label className="sr-only" htmlFor="schedule-file-select">Choose schedule</label>
          <select id="schedule-file-select" aria-label="Choose schedule" value={selectedFileId} onChange={handleSelectionChange} className="border border-gray-300 rounded px-2 py-1 text-sm">
            {files.map((file) => (
              <option key={file.id} value={file.id}>
                {file.title}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="flex-1 min-h-0 min-w-0 flex overflow-hidden">
        <div className="flex-1 min-h-0 min-w-0 flex overflow-hidden">
          <InteractionInstruction courseOps={courseOps} learningSession={learningSession} user={user} content={content} instructionState={instructionState} />
        </div>
      </div>
    </div>
  );
}
