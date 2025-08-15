import React from 'react';
import EditorMarkdown from './editorMarkdown';
import EditorFiles from './editorFiles';

export default function Editor({ course, setCourse, currentTopic, changeTopic }) {
  const [files, setFiles] = React.useState([]);

  React.useEffect(() => {
    async function fetchFiles() {
      setFiles([]);
      if (course && currentTopic?.path) {
        const fetchUrl = currentTopic.path.substring(0, currentTopic.path.lastIndexOf('/'));

        const res = await fetch(fetchUrl, {
          headers: { Authorization: `Bearer ${course.config.github.token}`, Accept: 'application/vnd.github+json' },
        });

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setFiles(data);
          } else {
            setFiles([]);
          }
        }
      }
    }

    fetchFiles();
  }, [course, currentTopic]);

  return (
    <div className="p-2 flex-1 flex flex-col">
      <EditorMarkdown course={course} setCourse={setCourse} currentTopic={currentTopic} changeTopic={changeTopic} />
      <EditorFiles files={files} setFiles={setFiles} />
    </div>
  );
}
