import React, { useState } from 'react';

export default function Settings({ course, editorVisible }) {
  function stripGithubPrefix(schedule, course) {
    const githubUrl = course.links.gitHub.rawUrl;
    if (githubUrl && schedule.startsWith(githubUrl)) {
      return schedule.slice(githubUrl.length).replace(/^\/+/, '');
    }
    return schedule || '';
  }

  const [formData, setFormData] = useState({
    title: course.title || '',
    schedule: stripGithubPrefix(course.schedule, course),
    description: course.description || '',
    githubAccount: course.gitHub.account,
    githubRepository: course.gitHub.repository,
  });

  const moduleCount = course.modules.length || 0;
  const topicCount = course.allTopics.length || 0;

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    alert('Functionality to save settings is not implemented yet.');
  };

  return (
    <div className="h-full overflow-auto p-4">
      <div className="max-w-3xl mx-auto">
        {/* Course Overview */}
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
            <div className="bg-white rounded-lg p-2 shadow-sm border">
              <div className="text-xl font-bold text-gray-800">{course.isDirty() ? 'Yes' : 'No'}</div>
              <div className="text-sm text-gray-600">Unsaved Changes</div>
            </div>
          </div>
        </div>
        {/* Course Information */}
        <div className="bg-gray-50 rounded-lg p-4 mb-1">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Course Information</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Course Title</label>
              {editorVisible ? <input type="text" value={formData.title} onChange={(e) => handleInputChange('title', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 text-sm bg-white" placeholder="Enter course title" /> : <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-md text-sm">{formData.title}</div>}
            </div>
            {/* Schedule */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Schedule Path</label>
              {editorVisible ? <input type="url" value={formData.schedule} onChange={(e) => handleInputChange('schedule', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 text-sm bg-white" placeholder="Enter schedule URL" /> : <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-md text-sm">{formData.schedule ? formData.schedule : <span className="text-gray-400">No schedule URL set</span>}</div>}
            </div>
            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              {editorVisible ? <textarea value={formData.description} onChange={(e) => handleInputChange('description', e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 text-sm bg-white" placeholder="Enter course description" /> : <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-md min-h-[60px] text-sm">{formData.description || <span className="text-gray-400">No description set</span>}</div>}
            </div>
          </div>
        </div>
        {/* GitHub Configuration */}
        <div className="bg-gray-50 rounded-lg p-4 mb-1">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">GitHub Repository</h2>
          <div className="space-y-3">
            {/* GitHub Account */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">GitHub Account</label>
              {editorVisible ? <input type="text" value={formData.githubAccount} onChange={(e) => handleInputChange('githubAccount', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 text-sm bg-white" placeholder="Enter GitHub username" /> : <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-md text-sm">{formData.githubAccount}</div>}
            </div>

            {/* GitHub Repository */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Repository Name</label>
              {editorVisible ? <input type="text" value={formData.githubRepository} onChange={(e) => handleInputChange('githubRepository', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 text-sm bg-white" placeholder="Enter repository name" /> : <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-md text-sm">{formData.githubRepository}</div>}
            </div>

            {/* GitHub Link */}
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
          <div className="flex justify-end">
            <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-colors">
              Save Changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
