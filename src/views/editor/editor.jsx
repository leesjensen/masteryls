import React from 'react';
import MarkdownEditor from './markdownEditor';
import EditorFiles from './editorFiles';
import VideoInstruction from '../instruction/videoInstruction';

export default function Editor({ service, user, course, setCourse, currentTopic, changeTopic }) {
  const [files, setFiles] = React.useState([]);

  React.useEffect(() => {
    async function fetchFiles() {
      setFiles([]);
      if (course && currentTopic?.path) {
        let fetchUrl = currentTopic.path.substring(0, currentTopic.path.lastIndexOf('/'));
        fetchUrl = fetchUrl.replace(course.links.gitHub.rawUrl, course.links.gitHub.apiUrl);
        const res = await service.makeGitHubApiRequest(user.gitHubToken(course.id), fetchUrl);

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

  const editorComponent = (type) => {
    switch (type) {
      case 'video':
        return (
          <>
            <div className="p-2 border-b border-gray-200 text-sm text-gray-500">
              <strong>URL</strong> {currentTopic?.path || ''}
            </div>
            <VideoInstruction topic={currentTopic} />
          </>
        );
      default:
        return (
          <>
            <MarkdownEditor service={service} user={user} course={course} setCourse={setCourse} currentTopic={currentTopic} changeTopic={changeTopic} />
            <EditorFiles files={files} setFiles={setFiles} />
          </>
        );
    }
  };

  return <div className="flex-1 flex flex-col overflow-hidden">{editorComponent(currentTopic?.type)}</div>;
}
