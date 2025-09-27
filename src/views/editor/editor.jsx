import React from 'react';
import MarkdownEditor from './markdownEditor';
import EditorFiles from './editorFiles';
import VideoEditor from './VideoEditor';

export default function Editor({ courseOps, service, user, course, setCourse, currentTopic, changeTopic }) {
  const [files, setFiles] = React.useState([]);

  React.useEffect(() => {
    async function fetchFiles() {
      setFiles([]);
      if (course && currentTopic?.path) {
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
  }, [course, currentTopic]);

  const editorComponent = (type) => {
    switch (type) {
      case 'video':
        return <VideoEditor currentTopic={currentTopic} course={course} setCourse={setCourse} changeTopic={changeTopic} />;
      default:
        return (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-8/10 flex overflow-hidden">
              <MarkdownEditor courseOps={courseOps} course={course} setCourse={setCourse} currentTopic={currentTopic} changeTopic={changeTopic} />
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
