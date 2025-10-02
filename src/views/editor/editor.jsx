import React from 'react';
import MarkdownEditor from './markdownEditor';
import EditorFiles from './editorFiles';
import VideoEditor from './VideoEditor';
import useLatest from '../../hooks/useLatest';

export default function Editor({ courseOps, service, user, course, setCourse, currentTopic }) {
  const [topicCommits, setTopicCommits] = React.useState([]);
  const [showCommits, setShowCommits] = React.useState(false);
  const [files, setFiles] = React.useState([]);
  const [content, setContent] = React.useState('');
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
    if (committing || !dirty) return; // Prevent multiple commits

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
            <div className="basis-[32px] flex items-center justify-between">
              <h1 className={`text-lg font-bold pl-2 ${dirty ? 'text-amber-400' : 'text-gray-800'}`}>Markdown</h1>
              <div className="flex items-center">
                <button className="mx-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:hover:bg-gray-400 text-xs" onClick={discard} disabled={!dirty || committing}>
                  Discard
                </button>
                <button className="mx-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:hover:bg-gray-400 text-xs flex items-center gap-2" onClick={commit} disabled={!dirty || committing}>
                  Commit
                </button>
                <button className="mx-1 px-3 py-1 bg-gray-100 text-blue-700 border border-blue-300 rounded hover:bg-blue-50 text-xs flex items-center gap-2" onClick={() => setShowCommits((v) => !v)}>
                  {showCommits ? 'Hide' : 'Show'} Commits
                </button>
              </div>
            </div>
            {showCommits && (
              <div className="max-h-64 overflow-auto border rounded bg-gray-50 p-2 my-2">
                <h2 className="text-md font-semibold mb-2">Previous Commits</h2>
                {topicCommits.length === 0 ? (
                  <div className="text-gray-500">No commits found for this topic.</div>
                ) : (
                  <ul className="text-xs">
                    {topicCommits.map((commit) => (
                      <li key={commit.sha} className="mb-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-bold">{commit.commit.author.name}</span> <span className="text-gray-400">({new Date(commit.commit.author.date).toLocaleString()})</span>
                            <a href={commit.html_url} target="_blank" rel="noopener noreferrer" className="pl-1 text-blue-600 underline">
                              {commit.sha.slice(0, 7)}
                            </a>
                          </div>
                          <button
                            className="ml-2 px-2 py-1 text-xs bg-blue-200 hover:bg-blue-300 rounded text-blue-900 border border-blue-300"
                            onClick={async () => {
                              const repoApiUrl = course.links.gitHub.apiUrl.replace(/\/contents.*/, '');
                              const filePath = currentTopic.path.replace(course.links.gitHub.rawUrl + '/', '');
                              const content = await service.getTopicContentAtCommit(user.getSetting('gitHubToken', course.id), repoApiUrl, filePath, commit.sha);
                              setContent(content);
                              setDirty(true);
                            }}
                          >
                            Use This Commit
                          </button>
                        </div>
                        <div className="text-gray-700">{commit.commit.message}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
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
