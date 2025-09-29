import React from 'react';
import MarkdownEditor from './markdownEditor';
import EditorFiles from './editorFiles';
import VideoEditor from './VideoEditor';

export default function Editor({ courseOps, service, user, course, setCourse, currentTopic }) {
  const [files, setFiles] = React.useState([]);

  const contentAvailable = currentTopic && currentTopic.path && (!currentTopic.state || currentTopic.state === 'stable');

  React.useEffect(() => {
    if (contentAvailable) {
      async function fetchFiles() {
        setFiles([]);
        if (course && contentAvailable) {
          let fetchUrl = currentTopic.path.substring(0, currentTopic.path.lastIndexOf('/'));
          fetchUrl = fetchUrl.replace(course.links.gitHub.rawUrl, course.links.gitHub.apiUrl);
          const res = await service.makeGitHubApiRequest(user.getSetting('gitHubToken', course.id), fetchUrl);

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
    }
  }, [course, currentTopic]);

  if (!contentAvailable) {
    return <div className="flex p-4 w-full select-none disabled bg-gray-200 text-gray-700">This topic content must be generated before it can be viewed.</div>;
  }

  const editorComponent = (type) => {
    switch (type) {
      case 'video':
        return <VideoEditor currentTopic={currentTopic} course={course} setCourse={setCourse} />;
      default:
        return (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-8/10 flex overflow-hidden">
              <MarkdownEditor courseOps={courseOps} setCourse={setCourse} currentTopic={currentTopic} />
            </div>
            <div className="flex-2/10 flex overflow-hidden">
              <EditorFiles files={files} setFiles={setFiles} />
            </div>
          </div>
        );
    }
  };

  return editorComponent(currentTopic?.type);
}
