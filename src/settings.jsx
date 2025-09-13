import React, { useState, useRef } from 'react';
import ConfirmDialog from './hooks/confirmDialog.jsx';
import { useAlert } from './contexts/AlertContext.jsx';

export default function Settings({ service, user, course, setCourse }) {
  const [settingsDirty, setSettingsDirty] = useState(false);
  const dialogRef = useRef(null);
  const { showAlert } = useAlert();

  const editorVisible = user.isEditor(course.id);
  const stagedCount = course.stagedCount();

  function stripGithubPrefix(schedule, course) {
    const githubUrl = course.links.gitHub.rawUrl;
    if (githubUrl && schedule.startsWith(githubUrl)) {
      return schedule.slice(githubUrl.length).replace(/^\/+/, '');
    }
    return schedule || '';
  }

  const [formData, setFormData] = useState({
    name: course.name || '',
    title: course.title || '',
    schedule: stripGithubPrefix(course.schedule, course),
    description: course.description || '',
    githubAccount: course.gitHub.account,
    githubRepository: course.gitHub.repository,
    gitHubToken: user.gitHubToken(course.id) || '',
  });

  const moduleCount = course.modules.length || 0;
  const topicCount = course.allTopics.length || 0;

  const handleInputChange = (field, value) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);

    const courseChanged = courseHasChanged(newFormData);
    const tokenChanged = field === 'gitHubToken' && gitHubTokenHasChanged(value);
    setSettingsDirty(tokenChanged || courseChanged);
    console.log(courseChanged, tokenChanged);
  };

  const courseHasChanged = (data) => {
    return data.title !== course.title || data.description !== course.description || data.githubAccount !== course.gitHub.account || data.githubRepository !== course.gitHub.repository;
  };

  const gitHubTokenHasChanged = (token) => {
    return token !== (user.gitHubToken(course.id) || '');
  };

  const handleSave = async () => {
    if (gitHubTokenHasChanged(formData.gitHubToken)) {
      const roles = user.updateRoleSettings(course.id, { [course.id]: { gitHubToken: formData.gitHubToken } });
      for (const role of roles) {
        await service.updateRoleSettings(role);
      }
    }
    if (courseHasChanged(formData)) {
      const catalogEntry = {
        id: course.id,
        name: formData.name,
        title: formData.title,
        description: formData.description,
        links: course.links,
        gitHub: {
          account: formData.githubAccount,
          repository: formData.githubRepository,
        },
      };
      service.saveCourseSettings(catalogEntry);
      const newCourse = course.updateCatalogEntry(catalogEntry);
      setCourse(newCourse);
      setSettingsDirty(false);
    }

    showAlert({
      message: (
        <div className="text-xs">
          <div>Settings saved</div>
        </div>
      ),
    });
  };

  const deleteCourse = async () => {
    await service.deleteCourse(user, course);
    setCourse(null);
    showAlert({
      message: (
        <div className="text-xs">
          <div>Course deleted</div>
        </div>
      ),
    });
  };

  return (
    <div className="h-full overflow-auto p-4">
      <ConfirmDialog
        dialogRef={dialogRef}
        title="Delete course"
        confirmed={deleteCourse}
        message={
          <div>
            <p>
              Because you are the owner of <b>{course.name}</b>, this action will <b>completely delete the course and all enrollments</b>.
            </p>
            <p className="pt-2">Are you sure you want to delete the course and all enrollments?</p>
          </div>
        }
      />
      <div className="max-w-3xl mx-auto">
        <div className="bg-gray-50 rounded-lg p-4 mb-1">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Course Overview</h2>
          <div className="grid grid-cols-1 gap-3 max-w-[180px]">
            <div className="bg-white rounded-lg p-2 shadow-sm border">
              <div className="text-xl font-bold text-gray-800">{moduleCount}</div>
              <div className="text-sm text-gray-600">Modules</div>
            </div>
            <div className="bg-white rounded-lg p-2 shadow-sm border">
              <div className="text-xl font-bold text-gray-800">{topicCount}</div>
              <div className="text-sm text-gray-600">Topics</div>
            </div>
            <div className={` rounded-lg p-2 shadow-sm border  ${stagedCount ? 'text-amber-500 bg-amber-50' : 'text-gray-800 bg-white'}`}>
              <div className="text-xl font-bold">{stagedCount}</div>
              <div className={`text-sm  ${stagedCount ? 'text-amber-500' : 'text-gray-600'}`}>Uncommitted topics</div>
            </div>
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 mb-1">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Course Information</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              {editorVisible ? <input type="text" value={formData.name} onChange={(e) => handleInputChange('name', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 text-sm bg-white" placeholder="Enter course name" /> : <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-md text-sm">{formData.name}</div>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              {editorVisible ? <input type="text" value={formData.title} onChange={(e) => handleInputChange('title', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 text-sm bg-white" placeholder="Enter course title" /> : <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-md text-sm">{formData.title}</div>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              {editorVisible ? <textarea value={formData.description} onChange={(e) => handleInputChange('description', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 text-sm bg-white min-h-[120px]" placeholder="Enter course description" /> : <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-md min-h-[120px] text-sm">{formData.description || <span className="text-gray-400">No description set</span>}</div>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">GitHub account</label>
              {editorVisible ? <input type="text" value={formData.githubAccount} onChange={(e) => handleInputChange('githubAccount', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 text-sm bg-white" placeholder="Enter GitHub username" /> : <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-md text-sm">{formData.githubAccount}</div>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Repository name</label>
              {editorVisible ? <input type="text" value={formData.githubRepository} onChange={(e) => handleInputChange('githubRepository', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 text-sm bg-white" placeholder="Enter repository name" /> : <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-md text-sm">{formData.githubRepository}</div>}
            </div>

            {user.isEditor(course.id) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GitHub token</label>
                <input type="text" value={formData.gitHubToken} onChange={(e) => handleInputChange('gitHubToken', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 text-sm bg-white" placeholder="Enter GitHub token" />
              </div>
            )}

            {course.links?.gitHub?.url && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Repository URL</label>
                <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-md text-sm">
                  <a href={course.links.gitHub.url} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:underline block truncate" style={{ maxWidth: '100%' }} title={course.links.gitHub.url}>
                    {course.links.gitHub.url}
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
        {editorVisible && (
          <div className="flex flex-col justify-end w-[200px]">
            <button disabled={!settingsDirty} onClick={handleSave} className="m-2 px-4 py-2 bg-blue-600 text-white rounded-md disabled:bg-gray-300 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-colors">
              Save changes
            </button>
            {user.isOwner() && (
              <button onClick={() => dialogRef.current.showModal()} className="m-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm transition-colors">
                Delete course
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
