import React from 'react';
import MarkdownEditor from './markdownEditor';
import EditorFiles from './editorFiles';
import VideoEditor from './VideoEditor';

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
        return <VideoEditor currentTopic={currentTopic} course={course} setCourse={setCourse} changeTopic={changeTopic} />;
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
