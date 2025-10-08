import React, { useState, useEffect } from 'react';

export default function EditorCommits({ currentTopic, course, user, service, setContent, setDirty }) {
  const [topicCommits, setTopicCommits] = useState([]);
  const [showCommits, setShowCommits] = useState(true);
  const [currentCommit, setCurrentCommit] = useState(currentTopic.commit);

  // Fetch commits when dependencies change
  useEffect(() => {
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

    const contentAvailable = currentTopic && currentTopic.path && (!currentTopic.state || currentTopic.state === 'stable');

    if (contentAvailable) {
      fetchCommits();
    }
  }, [course, currentTopic, user, service]);

  const handleApplyCommit = async (commit) => {
    const repoApiUrl = course.links.gitHub.apiUrl.replace(/\/contents.*/, '');
    const filePath = currentTopic.path.replace(course.links.gitHub.rawUrl + '/', '');
    const content = await service.getTopicContentAtCommit(user.getSetting('gitHubToken', course.id), repoApiUrl, filePath, commit.sha);
    setCurrentCommit(commit.sha);
    setContent(content);
    setDirty(true);
  };

  return (
    <div className="flex flex-col  my-1 w-full">
      <div className="flex justify-end w-full">
        <button className="mx-1 px-3 py-1 w-28 whitespace-nowrap bg-gray-100 text-blue-700 border border-blue-300 rounded hover:bg-blue-50 text-xs gap-2" onClick={() => setShowCommits((v) => !v)}>
          {showCommits ? 'Hide' : 'Show'} Commits
        </button>
      </div>
      {showCommits && (
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
                      <button className="mr-2 px-2 py-1 text-xs bg-blue-200 hover:bg-blue-300 rounded text-blue-900 border border-blue-300" onClick={() => handleApplyCommit(commit)}>
                        Diff
                      </button>
                    </>
                  )}
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
    </div>
  );
}
