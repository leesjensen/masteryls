import React from 'react';
import Instruction from '../instruction/instruction.jsx';
import MarkdownEditor from './markdownEditor';
import EditorFiles from './editorFiles';
import VideoEditor from './VideoEditor';
import useLatest from '../../hooks/useLatest';

export default function Editor({ courseOps, service, user, course, setCourse, currentTopic }) {
  const [topicCommits, setTopicCommits] = React.useState([]);
  const [showCommits, setShowCommits] = React.useState(false);
  const [files, setFiles] = React.useState([]);
  const [content, setContent] = React.useState('');
  const [preview, setPreview] = React.useState(false);
  const [committing, setCommitting] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const dirtyRef = useLatest(dirty);
  const contentRef = useLatest(content);

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

      // Fetch previous commits for the current topic file
      async function fetchCommits() {
        if (course && currentTopic && currentTopic.path && course.links?.gitHub?.apiUrl) {
          // Build the GitHub API URL for commits for the topic file
          const repoApiUrl = course.links.gitHub.apiUrl.replace(/\/contents.*/, '');
          const filePath = currentTopic.path.replace(course.links.gitHub.rawUrl + '/', '');
          const commitsUrl = `${repoApiUrl}/commits?path=${filePath}&cachebust=${Date.now()}`;
          const commits = await service.getTopicCommits(user.getSetting('gitHubToken', course.id), commitsUrl);
          setTopicCommits(commits);
        }
      }
      fetchCommits();

      courseOps.getTopicMarkdown(currentTopic).then((markdown) => {
        setContent(markdown);
        setDirty(false);
      });

      return async () => {
        if (dirtyRef.current) {
          if (window.confirm('Do you want to commit your changes?')) {
            await commit();
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
    console.log('commit called', committing, dirty);
    if (committing || !dirtyRef.current) return;

    setCommitting(true);
    try {
      const updatedTopic = await courseOps.updateTopic(currentTopic, contentRef.current);
      setDirty(false);
      courseOps.changeTopic(updatedTopic);
    } catch (error) {
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
            <div className="basis-[32px] pt-2 flex items-center justify-between">
              <h1 className={`text-lg font-bold pl-2 ${dirty ? 'text-amber-400' : 'text-gray-800'}`}>Editor</h1>

              <div className="flex items-center">
                <button className="mx-1 px-3 py-1 w-18 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:hover:bg-gray-400 text-xs" onClick={() => setPreview((v) => !v)}>
                  {preview ? 'Edit' : 'Preview'}
                </button>
                <button className="mx-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:hover:bg-gray-400 text-xs" onClick={discard} disabled={!dirty || committing}>
                  Discard
                </button>
                <button className="mx-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:hover:bg-gray-400 text-xs flex items-center gap-2" onClick={commit} disabled={!dirty || committing}>
                  Commit
                </button>
                <button className="mx-1 px-3 py-1 w-28 whitespace-nowrap bg-gray-100 text-blue-700 border border-blue-300 rounded hover:bg-blue-50 text-xs gap-2" onClick={() => setShowCommits((v) => !v)}>
                  {showCommits ? 'Hide' : 'Show'} Commits
                </button>
              </div>
            </div>
            {showCommits && (
              <div className="max-h-64 overflow-auto border border-gray-300 rounded bg-gray-50 p-2 m-2">
                <ul className="text-xs">
                  {topicCommits.map((commit) => (
                    <li key={commit.sha} className="mb-2">
                      <div className="flex items-center justify-start  border border-gray-300 rounded p-1 w-full">
                        <button
                          className="mr-2 px-2 py-1 text-xs bg-blue-200 hover:bg-blue-300 rounded text-blue-900 border border-blue-300"
                          onClick={async () => {
                            const repoApiUrl = course.links.gitHub.apiUrl.replace(/\/contents.*/, '');
                            const filePath = currentTopic.path.replace(course.links.gitHub.rawUrl + '/', '');
                            const content = await service.getTopicContentAtCommit(user.getSetting('gitHubToken', course.id), repoApiUrl, filePath, commit.sha);
                            setContent(content);
                            setDirty(true);
                          }}
                        >
                          Apply
                        </button>
                        <div className="flex flex-col">
                          <div className="flex flex-row">
                            <a href={commit.html_url} target="_blank" rel="noopener noreferrer" className="pr-1 text-blue-600 underline">
                              {commit.sha.slice(0, 7)}
                            </a>
                            <span className="font-bold pr-1">{commit.commit.author.name}</span>
                            <span className="text-gray-400 pr-1">({new Date(commit.commit.author.date).toLocaleString()})</span>
                          </div>
                          <div className="text-gray-700">{commit.commit.message}</div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex-8/10 flex overflow-hidden">{preview ? <Instruction courseOps={courseOps} topic={currentTopic} course={course} user={user} preview={content} /> : <MarkdownEditor content={content} onChange={handleEditorChange} commit={commit} />}</div>
            <div className="flex-2/10 flex overflow-hidden">
              <EditorFiles files={files} setFiles={setFiles} />
            </div>
          </div>
        );
    }
  };

  return editorComponent(currentTopic?.type);
}
