import React from 'react';
import MarkdownEditor from './markdownEditor';
import EditorFiles from './editorFiles';
import VideoEditor from './VideoEditor';
import useLatest from '../../hooks/useLatest';

export default function Editor({ courseOps, service, user, course, setCourse, currentTopic }) {
  const [files, setFiles] = React.useState([]);
  const [content, setContent] = React.useState('');
  const [committing, setCommitting] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const dirtyRef = useLatest(dirty);

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

      courseOps.getTopicMarkdown(currentTopic).then((markdown) => {
        setContent(markdown);
        setDirty(false);
      });

      return async () => {
        if (dirtyRef.current) {
          const shouldSave = window.confirm('Do you want to commit your changes?');
          if (shouldSave) {
            commit();
          }
        }
      };
    }
  }, [course, currentTopic]);

  function handleEditorChange(value) {
    if (committing) return;
    setContent(value || '');
    setDirty(true);
  }

  async function discard() {
    const [updatedCourse, previousTopic, markdown] = await courseOps.discardTopicMarkdown(currentTopic);
    setDirty(false);
    setContent(markdown);
    courseOps.changeTopic(previousTopic);
    setCourse(updatedCourse);
  }

  async function commit() {
    if (committing) return; // Prevent multiple commits

    setCommitting(true);
    try {
      const updatedTopic = await courseOps.updateTopic(currentTopic, content);
      setDirty(false);
      courseOps.changeTopic(updatedTopic);
    } catch (error) {
      console.error('Error committing changes:', error);
      alert('Failed to commit changes. Please try again.');
    } finally {
      setCommitting(false);
    }
  }

  if (!contentAvailable) {
    return <div className="flex p-4 w-full select-none disabled bg-gray-200 text-gray-700">This topic content must be generated before it can be viewed.</div>;
  }

  const editorComponent = (type) => {
    switch (type) {
      case 'video':
        return <VideoEditor currentTopic={currentTopic} course={course} setCourse={setCourse} />;
      default:
        return (
          <div className="flex-1 flex flex-col overflow-hidden relative">
            {committing && (
              <div className="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center z-50 rounded">
                <div className="flex items-center gap-3 text-gray-700">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-blue-600"></div>
                  <span className="text-sm font-medium">Committing changes...</span>
                </div>
              </div>
            )}
            <div className="basis-[32px] flex items-center justify-between">
              <h1 className="text-lg font-bold">Markdown</h1>
              <div className="flex items-center">
                <button className="mx-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:hover:bg-gray-400 text-xs" onClick={discard} disabled={!dirty || committing}>
                  Discard
                </button>
                <button className="mx-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:hover:bg-gray-400 text-xs flex items-center gap-2" onClick={commit} disabled={!dirty || committing}>
                  Commit
                </button>
              </div>
            </div>
            <div className="flex-8/10 flex overflow-hidden">
              <MarkdownEditor content={content} onChange={handleEditorChange} commit={commit} />
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
