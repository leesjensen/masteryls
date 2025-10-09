import React, { useState, useEffect } from 'react';

export default function EditorCommits({ currentTopic, course, user, service, setContent, setDiffContent, setDirty }) {
  const [topicCommits, setTopicCommits] = useState([]);
  const [currentCommit, setCurrentCommit] = useState(currentTopic.commit);
  const [diffCommit, setDiffCommit] = useState(null);

  // Fetch commits
  useEffect(() => {
    async function fetchCommits() {
      console.log('Fetching commits for topic:', currentTopic.commit);
      if (course && currentTopic && currentTopic.path && course.links?.gitHub?.apiUrl) {
        const repoApiUrl = course.links.gitHub.apiUrl.replace(/\/contents.*/, '');
        const filePath = currentTopic.path.replace(course.links.gitHub.rawUrl + '/', '');
        const commitsUrl = `${repoApiUrl}/commits?path=${filePath}&cachebust=${Date.now()}`;
        const commits = await service.getTopicCommits(user.getSetting('gitHubToken', course.id), commitsUrl);
        setTopicCommits(commits);
        setCurrentCommit(currentTopic.commit);
      }
    }

    const contentAvailable = currentTopic && currentTopic.path && (!currentTopic.state || currentTopic.state === 'stable');

    if (contentAvailable) {
      fetchCommits();
    }
  }, [course, currentTopic, user, service]);

  const loadCommit = async (commit) => {
    const repoApiUrl = course.links.gitHub.apiUrl.replace(/\/contents.*/, '');
    const filePath = currentTopic.path.replace(course.links.gitHub.rawUrl + '/', '');
    return service.getTopicContentAtCommit(user.getSetting('gitHubToken', course.id), repoApiUrl, filePath, commit.sha);
  };

  const handleApplyCommit = async (commit) => {
    const content = await loadCommit(commit);
    setCurrentCommit(commit.sha);
    setContent(content);
    setDirty(true);
  };

  const handleDiffCommit = async (commit) => {
    const content = await loadCommit(commit);
    setDiffContent(content);
    setDiffCommit(commit.sha);
  };

  const clearDiff = () => {
    setDiffContent(null);
    setDiffCommit(null);
  };

  return (
    <div className="max-h-64 overflow-auto border border-gray-300 rounded bg-gray-50 p-2 m-2 ">
      <ul className="text-xs">
        {topicCommits.map((commit, idx) => (
          <li key={commit.sha} className="mb-2">
            <div className="flex items-center justify-start border border-gray-300 rounded p-1 w-full">
              {commit.sha !== currentCommit && (
                <>
                  <button className="mr-2 px-2 py-1 text-xs bg-blue-200 hover:bg-blue-300 rounded text-blue-900 border border-blue-300" onClick={() => handleApplyCommit(commit)}>
                    Apply
                  </button>
                  {diffCommit !== commit.sha && (
                    <button className="mr-2 px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded text-gray-900 border border-gray-300" onClick={() => handleDiffCommit(commit)}>
                      Diff
                    </button>
                  )}
                  {diffCommit === commit.sha && (
                    <button className="mr-2 px-2 py-1 text-xs bg-amber-200 hover:bg-amber-300 rounded text-amber-900 border border-amber-300" onClick={() => clearDiff()}>
                      Diff
                    </button>
                  )}
                </>
              )}
              <div className="flex flex-col">
                <div className="flex flex-row">
                  <a href={commit.html_url} target="_blank" rel="noopener noreferrer" className="pr-1 text-amber-600 underline">
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
  );
}
