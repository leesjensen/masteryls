import React, { useState } from 'react';

export default function CourseForm({ onClose, onCreate }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [name, setName] = useState('');
  const [gitHubToken, setGitHubToken] = useState('');
  const [gitHubAccount, setGitHubAccount] = useState('');
  const [gitHubRepo, setGitHubRepo] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (onCreate) {
      onCreate({ title, description, name, gitHub: { account: gitHubAccount, repository: gitHubRepo } }, gitHubToken);
    }
  }

  const isValid = title.trim() && description.trim() && name.trim() && gitHubAccount.trim() && gitHubRepo.trim() && gitHubToken.trim();

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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="gitHub-account" className="block text-sm font-medium text-gray-700 mb-1">
                GitHub Account
              </label>
              <input id="gitHub-account" name="gitHubAccount" value={gitHubAccount} onChange={(e) => setGithubAccount(e.target.value)} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-300" placeholder="your-gitHub-username" />
            </div>

            <div>
              <label htmlFor="gitHub-repo" className="block text-sm font-medium text-gray-700 mb-1">
                GitHub Repo
              </label>
              <input id="gitHub-repo" name="gitHubRepo" value={gitHubRepo} onChange={(e) => setGithubRepo(e.target.value)} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-300" placeholder="repo-name" />
            </div>
          </div>

          <div>
            <label htmlFor="gitHub-token" className="block text-sm font-medium text-gray-700 mb-1">
              GitHub Token
            </label>
            <input id="gitHub-token" name="gitHubToken" type="password" value={gitHubToken} onChange={(e) => setGithubToken(e.target.value)} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-300" placeholder="Personal access token" />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm">
              Cancel
            </button>

            <button type="submit" disabled={!isValid} className={`px-4 py-2 rounded-md text-white font-semibold text-sm shadow ${isValid ? 'bg-amber-400 hover:bg-amber-500' : 'bg-gray-300 cursor-not-allowed'}`}>
              Create Course
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
