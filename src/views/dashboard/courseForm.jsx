import React, { useState } from 'react';

export default function CourseForm({ service, onClose, onCreate }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [name, setName] = useState('');
  const [gitHubToken, setGitHubToken] = useState('');
  const [gitHubAccount, setGitHubAccount] = useState('');
  const [gitHubRepo, setGitHubRepo] = useState('');
  const [gitHubSourceAccount, setGitHubSourceAccount] = useState('csinstructiontemplate');
  const [gitHubSourceRepo, setGitHubSourceRepo] = useState('');
  const [gitHubTemplates, setGitHubTemplates] = useState([]);

  React.useEffect(() => {
    service
      .getTemplateRepositories(gitHubSourceAccount)
      .then((templates) => {
        setGitHubTemplates(templates);
      })
      .catch((error) => {
        console.error('Error fetching GitHub templates:', error);
        setGitHubTemplates([]);
      });
  }, [gitHubSourceAccount]);

  function handleSubmit(e) {
    e.preventDefault();
    if (onCreate) {
      onCreate(gitHubSourceAccount, gitHubSourceRepo, { title, description, name, gitHub: { account: gitHubAccount, repository: gitHubRepo } }, gitHubToken);
    }
  }

  const isValid = title.trim() && description.trim() && name.trim() && gitHubSourceRepo.trim() && gitHubAccount.trim() && gitHubRepo.trim() && gitHubToken.trim();

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-start pt-16 p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-xl font-semibold text-gray-800">Create a Course</h2>
          <p className="text-sm text-gray-500 mt-1">Add a title and short description for your new course.</p>
        </div>

        <form className="p-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="course-name" className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input id="course-name" name="name" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-300" placeholder="Display name for the course (e.g. cs260)" />
          </div>

          <div>
            <label htmlFor="course-title" className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input id="course-title" name="title" required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-300" placeholder="e.g. Intro to React" />
          </div>

          <div>
            <label htmlFor="course-description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea id="course-description" name="description" required rows={5} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-300 resize-y" placeholder="Short summary of what learners will accomplish" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-1 border-gray-300 rounded-sm p-2">
            <div>
              <label htmlFor="source-gitHub-account" className="block text-sm font-medium text-gray-700 mb-1">
                Source GitHub Account
              </label>
              <input id="source-gitHub-account" name="gitHubAccount" value={gitHubSourceAccount} onChange={(e) => setGitHubSourceAccount(e.target.value)} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
              <p className="text-xs text-gray-400 mt-1">Only accounts with public template repositories are eligible.</p>
            </div>

            <div>
              <label htmlFor="source-gitHub-template" className="block text-sm font-medium text-gray-700 mb-1">
                Source GitHub Template
              </label>
              <select
                id="source-gitHub-template"
                disabled={gitHubTemplates.length === 0}
                name="gitHubTemplate"
                value={gitHubSourceRepo}
                onChange={(e) => setGitHubSourceRepo(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-300
                  disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed bg-white text-gray-700 border-gray-200
                "
              >
                <option value="">Select a template...</option>
                {gitHubTemplates.map((template) => (
                  <option key={template} value={template}>
                    {template}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-1 border-gray-300 rounded-sm p-2 ">
            <div>
              <label htmlFor="gitHub-account" className="block text-sm font-medium text-gray-700 mb-1">
                Course GitHub Account
              </label>
              <input id="gitHub-account" name="gitHubAccount" value={gitHubAccount} onChange={(e) => setGitHubAccount(e.target.value)} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-300" placeholder="your-gitHub-username" />
            </div>

            <div>
              <label htmlFor="gitHub-repo" className="block text-sm font-medium text-gray-700 mb-1">
                Course GitHub Repo
              </label>
              <input id="gitHub-repo" name="gitHubRepo" value={gitHubRepo} onChange={(e) => setGitHubRepo(e.target.value)} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-300" placeholder="repo-name" />
            </div>

            <div>
              <label htmlFor="gitHub-token" className="block text-sm font-medium text-gray-700 mb-1">
                GitHub Token
              </label>
              <input id="gitHub-token" name="gitHubToken" value={gitHubToken} onChange={(e) => setGitHubToken(e.target.value)} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-300" placeholder="Personal access token" />
              <p className="text-xs text-gray-400 mt-1">The token must be a fine-grained Personal Access Token with admin and repo write rights.</p>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm">
              Cancel
            </button>

            <button type="submit" disabled={!isValid} className={`px-4 py-2 rounded-md text-white font-semibold text-sm shadow bg-amber-400 hover:bg-amber-500 disabled:bg-gray-300 disabled:cursor-not-allowed`}>
              Create Course
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
