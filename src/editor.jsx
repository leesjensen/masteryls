import React from 'react';
import EditorMarkdown from './editorMarkdown';
import EditorFiles from './editorFiles';

export default function Editor({ course, setCourse, currentTopic, changeTopic }) {
  return (
    <div className="p-2 flex-1 flex flex-col">
      <EditorMarkdown course={course} setCourse={setCourse} currentTopic={currentTopic} changeTopic={changeTopic} />
      <EditorFiles course={course} currentTopic={currentTopic} />
    </div>
  );
}
