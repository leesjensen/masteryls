import React, { useState, useRef, useEffect } from 'react';
import ConfirmDialog from './hooks/confirmDialog.jsx';
import UserSelectionDialog from './components/UserSelectionDialog.jsx';
import { useAlert } from './contexts/AlertContext.jsx';
import { useNavigate } from 'react-router-dom';

export default function Settings({ courseOps, user, course }) {
  const [settingsDirty, setSettingsDirty] = useState(false);
  const deleteDialogRef = useRef(null);
  const navigate = useNavigate();
  const { showAlert } = useAlert();
  const [enrollmentCount, setEnrollmentCount] = useState(0);
  const [selectedEditors, setSelectedEditors] = useState([]);
  const [editorUsers, setEditorUsers] = useState([]);
  const [editorsDialogOpen, setEditorsDialogOpen] = useState(false);
  const ogSelectedEditorsRef = useRef([]);
  const userCache = useRef(new Map());
  const [formData, setFormData] = useState({
    name: course.name || '',
    title: course.title || '',
    description: course.description || '',
    githubAccount: course.gitHub.account,
    githubRepository: course.gitHub.repository,
    gitHubToken: user?.getSetting('gitHubToken', course.id) || '',
    state: course.settings.state,
    deleteProtected: course.settings.deleteProtected || false,
  });

  const moduleCount = course.modules.length || 0;
  const topicCount = course.allTopics.length || 0;

  const fetchEditors = async () => {
    try {
      const fetchedEditors = await courseOps.service.getEditorsForCourse(course.id);
      setEditorUsers(fetchedEditors);
      fetchedEditors.forEach((editor) => userCache.current.set(editor.id, editor));
      const editorIds = fetchedEditors.map((editor) => editor.id);
      ogSelectedEditorsRef.current = editorIds;
      setSelectedEditors(editorIds);
      return fetchedEditors;
    } catch (error) {
      showAlert({
        type: 'error',
        message: (
          <div className="text-xs">
            <div>{error.message || 'Failed to load editors'}</div>
          </div>
        ),
      });
      return [];
    }
  };

  useEffect(() => {
    courseOps.service.allEnrollments(course.id).then((enrollments) => {
      setEnrollmentCount(enrollments.length);
    });
  }, [course.id, courseOps.service]);

  useEffect(() => {
    fetchEditors();
  }, [course.id, courseOps.service, showAlert]);

  useEffect(() => {
    const [editorsChanged, ,] = compareEditors(selectedEditors);
    const courseChanged = compareCourse(formData);
    const tokenChanged = compareGitHubToken(formData.gitHubToken);
    setSettingsDirty(tokenChanged || courseChanged || editorsChanged);
  }, [selectedEditors, formData]);

  const handleInputChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const compareEditors = (newSelected) => {
    const currentEditors = new Set(ogSelectedEditorsRef.current);
    const newEditors = new Set(newSelected);

    const toAdd = newSelected.filter((id) => !currentEditors.has(id));
    const toRemove = ogSelectedEditorsRef.current.filter((id) => !newEditors.has(id));

    return [toAdd.length !== 0 || toRemove.length !== 0, toAdd, toRemove];
  };

  const compareCourse = (data) => {
    return data.name !== course.name || data.title !== course.title || data.description !== course.description || data.githubAccount !== course.gitHub.account || data.githubRepository !== course.gitHub.repository || data.state !== course.settings.state || data.deleteProtected !== (course.settings?.deleteProtected || false);
  };

  const compareGitHubToken = (token) => {
    return token !== (user?.getSetting('gitHubToken', course.id) || '');
  };

  const handleSave = async () => {
    const [editorsChanged, toAdd, toRemove] = compareEditors(selectedEditors);
    if (editorsChanged && selectedEditors.length === 0) {
      showAlert({
        type: 'error',
        message: (
          <div className="text-xs">
            <div>At least one editor must be selected</div>
          </div>
        ),
      });
      return;
    }

    if (compareGitHubToken(formData.gitHubToken)) {
      await courseOps.service.updateUserRoleSettings(user, 'editor', course.id, { gitHubToken: formData.gitHubToken });
    }

    if (compareCourse(formData)) {
      const catalogEntry = {
        id: course.id,
        name: formData.name,
        title: formData.title,
        description: formData.description,
        gitHub: {
          account: formData.githubAccount,
          repository: formData.githubRepository,
        },
        links: course.links,
        settings: {
          ...course.settings,
          state: formData.state,
          deleteProtected: formData.deleteProtected,
        },
      };
      courseOps.service.saveCatalogEntry(catalogEntry);
      const newCourse = course.copyWithNewSettings(catalogEntry);
      courseOps.setCurrentCourse(newCourse);
    }

    if (editorsChanged) {
      const editorUser = editorUsers.find((u) => u.roles?.find((r) => r.right === 'editor' && r.object === course.id));
      if (!editorUser) {
        showAlert({
          type: 'error',
          message: (
            <div className="text-xs">
              <div>Unable to determine editor settings. Please refresh and try again.</div>
            </div>
          ),
        });
        return;
      }
      const gitHubToken = editorUser.getRole('editor', course.id).settings.gitHubToken;
      for (const userId of toAdd) {
        const user = userCache.current.get(userId);
        if (!user) {
          showAlert({
            type: 'error',
            message: (
              <div className="text-xs">
                <div>Unable to add an editor because user data is missing.</div>
              </div>
            ),
          });
          continue;
        }
        await courseOps.service.addUserRole(user, 'editor', course.id, { gitHubToken });
      }
      for (const userId of toRemove) {
        const user = userCache.current.get(userId);
        if (!user) {
          showAlert({
            type: 'error',
            message: (
              <div className="text-xs">
                <div>Unable to remove an editor because user data is missing.</div>
              </div>
            ),
          });
          continue;
        }
        await courseOps.service.removeUserRole(user, 'editor', course.id);
      }
      await fetchEditors();
    }

    setSettingsDirty(false);
    showAlert({
      message: (
        <div className="text-xs">
          <div>Settings saved</div>
        </div>
      ),
    });
  };

  const deleteCourse = async () => {
    await courseOps.service.deleteCourse(user, course);
    courseOps.setCurrentCourse(null);
    navigate('/dashboard');
    showAlert({
      message: (
        <div className="text-xs">
          <div>Course deleted</div>
        </div>
      ),
    });
  };

  const reindexSearch = async () => {
    try {
      await courseOps.reindexCourse(course.id);
      showAlert({
        message: (
          <div className="text-xs">
            <div>Search reindexing started</div>
          </div>
        ),
      });
    } catch (error) {
      showAlert({
        type: 'error',
        message: (
          <div className="text-xs">
            <div>{error.message || 'Failed to start search reindexing'}</div>
          </div>
        ),
      });
    }
  };

  if (!user) {
    return null;
  }

  const editorVisible = user.isEditor(course.id);
  const editorsCount = selectedEditors.length;
  const isOriginalEditor = (userId) => ogSelectedEditorsRef.current.includes(userId);

  return (
    <div className="h-full overflow-auto p-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-gray-50 rounded-lg p-4 mb-1">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Overview</h2>
          <div className="mb-2">
            <span className="text-xs text-gray-500">Course ID:</span>
            <span className="ml-2 text-xs font-mono text-gray-700 max-w-full truncate block">{course.id}</span>
          </div>
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
              <div className="text-xl font-bold text-gray-800">{enrollmentCount}</div>
              <div className="text-sm text-gray-600">Enrollments</div>
            </div>
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 mb-1">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Information</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Name</label>
              {editorVisible ? <input type="text" value={formData.name} onChange={(e) => handleInputChange('name', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 text-sm bg-white" placeholder="Enter course name" /> : <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-md text-sm">{formData.name}</div>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Title</label>
              {editorVisible ? <input type="text" value={formData.title} onChange={(e) => handleInputChange('title', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 text-sm bg-white" placeholder="Enter course title" /> : <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-md text-sm">{formData.title}</div>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
              {editorVisible ? <textarea value={formData.description} onChange={(e) => handleInputChange('description', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 text-sm bg-white min-h-[120px]" placeholder="Enter course description" /> : <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-md min-h-[120px] text-sm">{formData.description || <span className="text-gray-400">No description set</span>}</div>}
            </div>

            <h2 className="text-lg font-semibold text-gray-800 mb-3">Settings</h2>
            {editorVisible && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">State</label>
                  <div className="flex gap-4">
                    <label className="flex items-center cursor-pointer">
                      <input type="radio" value="published" checked={formData.state === 'published'} onChange={(e) => handleInputChange('state', e.target.value)} className="mr-2 cursor-pointer" />
                      <span className="text-sm text-gray-700">Published</span>
                    </label>
                    <label className="flex items-center cursor-pointer">
                      <input type="radio" value="unpublished" checked={formData.state === 'unpublished'} onChange={(e) => handleInputChange('state', e.target.value)} className="mr-2 cursor-pointer" />
                      <span className="text-sm text-gray-700">Unpublished</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className="flex items-center cursor-pointer">
                    <input type="checkbox" checked={formData.deleteProtected} onChange={(e) => handleInputChange('deleteProtected', e.target.checked)} className="mr-2 cursor-pointer" />
                    <span className="text-sm font-medium text-gray-700">Delete Protected</span>
                  </label>
                </div>
              </>
            )}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">GitHub account</label>
              {editorVisible ? <input type="text" value={formData.githubAccount} onChange={(e) => handleInputChange('githubAccount', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 text-sm bg-white" placeholder="Enter GitHub username" /> : <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-md text-sm">{formData.githubAccount}</div>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Repository name</label>
              {editorVisible ? <input type="text" value={formData.githubRepository} onChange={(e) => handleInputChange('githubRepository', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 text-sm bg-white" placeholder="Enter repository name" /> : <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-md text-sm">{formData.githubRepository}</div>}
            </div>

            {user.isEditor(course.id) && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">GitHub token</label>
                  <input type="text" value={formData.gitHubToken} onChange={(e) => handleInputChange('gitHubToken', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 text-sm bg-white" placeholder="Enter GitHub token" />
                </div>
              </>
            )}

            {course.links?.gitHub?.url && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Repository URL</label>
                <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-md text-sm">
                  <a href={course.links.gitHub.url} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:underline block truncate" style={{ maxWidth: '100%' }} title={course.links.gitHub.url}>
                    {course.links.gitHub.url}
                  </a>
                </div>
              </div>
            )}

            {course.externalRefs && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">External references</label>
                {Object.entries(course.externalRefs).map(([key, ref]) => {
                  if (key !== 'canvasCourseId') return null;
                  const url = `https://byu.instructure.com/courses/${ref}`;
                  return (
                    <div key={key}>
                      <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-md text-sm">
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:underline block truncate" style={{ maxWidth: '100%' }} title={ref.url}>
                          {url}
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        {editorVisible && (
          <>
            <div className="bg-gray-50 rounded-lg p-4 mb-1">
              <div>
                <h2 className="text-lg font-semibold mb-3 text-gray-800">Search</h2>
                <div className="flex items-center justify-between">
                  <button type="button" onClick={() => reindexSearch()} className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-100">
                    Reindex
                  </button>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 mb-1">
              <div>
                <h2 className="text-lg font-semibold mb-3 text-gray-800">Editors</h2>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-700">
                      {editorsCount} editor{editorsCount === 1 ? '' : 's'} assigned
                    </div>
                  </div>
                  <button type="button" onClick={() => setEditorsDialogOpen(true)} className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-100">
                    Manage editors
                  </button>
                </div>
              </div>
            </div>
            <div>
              <div className="flex flex-col justify-end w-[200px]">
                <button disabled={!settingsDirty} onClick={handleSave} className="m-2 px-4 py-2 bg-blue-600 text-white rounded-md disabled:bg-gray-300 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-colors">
                  Save changes
                </button>
                {user?.isEditor(course.id) && user?.isRoot() && (
                  <button disabled={course.settings?.deleteProtected} onClick={() => deleteDialogRef.current.showModal()} className="m-2 px-4 py-2 disabled:bg-gray-300 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm transition-colors">
                    Delete course
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
      <ConfirmDialog
        dialogRef={deleteDialogRef}
        title="⚠️ Delete course"
        confirmed={deleteCourse}
        message={
          <div>
            <p>This will completely delete:</p>
            <ol className="mt-2 pl-2 list-decimal list-inside">
              <li>
                The course - <b>{course.name}</b>
              </li>
              <li>
                The repository -
                <b>
                  {' ' + course.gitHub.account}/{course.gitHub.repository}
                </b>
              </li>
              <li>All progress records</li>
              <li>All enrollments</li>
            </ol>
            <p className="pt-2">
              Are you sure you want to <b>irretrievably</b> destroy all of this?
            </p>
          </div>
        }
      />
      <UserSelectionDialog title="Manage editors" description="Add or remove editors. Changes are saved when you click Save changes." currentUsersLabel="Current editors" searchUsersLabel="Find users" selectedUserIds={selectedEditors} onSelectionChange={setSelectedEditors} searchUsers={(query) => courseOps.service.searchUsers(query, 25)} isOpen={editorsDialogOpen} onOpen={() => setEditorsDialogOpen(true)} onClose={() => setEditorsDialogOpen(false)} allowEmpty={false} isOriginalUser={isOriginalEditor} userCache={userCache.current} />
    </div>
  );
}
