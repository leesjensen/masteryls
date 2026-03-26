import React from 'react';
import InteractionInstruction from './interaction/interactionInstruction';

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
  }, [learningSession?.topic?.id]);

  React.useEffect(() => {
    const topic = learningSession?.topic;
    if (!topic || topic.type !== 'schedule') {
      return;
    }

    if (!selectedFileId) {
      return;
    }

    courseOps.getScheduleTopicContent(topic, selectedFileId).then((markdown) => {
      setContent(markdown || '');
    });
  }, [selectedFileId, learningSession?.topic?.id]);

  function handleSelectionChange(event) {
    const fileId = event.target.value;
    setSelectedFileId(fileId);
    courseOps.setSelectedScheduleFile(learningSession.topic, fileId);
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-gray-200 bg-gray-50">
        <label className="text-sm text-gray-700 flex items-center gap-2">
          Schedule
          <select value={selectedFileId} onChange={handleSelectionChange} className="border border-gray-300 rounded px-2 py-1 text-sm">
            {files.map((file) => (
              <option key={file.id} value={file.id}>
                {file.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex-1 overflow-auto">
        <InteractionInstruction courseOps={courseOps} learningSession={learningSession} user={user} content={content} instructionState={instructionState} />
      </div>
    </div>
  );
}
