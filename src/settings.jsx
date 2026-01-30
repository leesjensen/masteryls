import React, { useState, useRef, useEffect } from 'react';
import ConfirmDialog from './hooks/confirmDialog.jsx';
import { useAlert } from './contexts/AlertContext.jsx';
import { useNavigate } from 'react-router-dom';

export default function Settings({ courseOps, user, course }) {
  const [settingsDirty, setSettingsDirty] = useState(false);
  const deleteDialogRef = useRef(null);
  const editorsDialogRef = useRef(null);
  const navigate = useNavigate();
  const { showAlert } = useAlert();
  const [enrollmentCount, setEnrollmentCount] = useState(0);
  const [selectedEditors, setSelectedEditors] = useState([]);
  const [editorUsers, setEditorUsers] = useState([]);
  const [editorsLoading, setEditorsLoading] = useState(false);
  const [editorSearchQuery, setEditorSearchQuery] = useState('');
  const [editorSearchResults, setEditorSearchResults] = useState([]);
  const [editorSearchLoading, setEditorSearchLoading] = useState(false);
  const [editorSearchError, setEditorSearchError] = useState('');
  const [knownUsers, setKnownUsers] = useState(new Map());
  const [editorsDialogOpen, setEditorsDialogOpen] = useState(false);
  const ogSelectedEditorsRef = useRef([]);
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
    setEditorsLoading(true);
    try {
      const fetchedEditors = await courseOps.service.getEditorsForCourse(course.id);
      setEditorUsers(fetchedEditors);
      setKnownUsers((prev) => {
        const next = new Map(prev);
        fetchedEditors.forEach((editor) => next.set(editor.id, editor));
        return next;
      });
      const editorIds = fetchedEditors.map((editor) => editor.id);
      ogSelectedEditorsRef.current = editorIds;
      setSelectedEditors(editorIds);
    } catch (error) {
      showAlert({
        type: 'error',
        message: (
          <div className="text-xs">
            <div>{error.message || 'Failed to load editors'}</div>
          </div>
        ),
      });
    } finally {
      setEditorsLoading(false);
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
    if (!editorsDialogOpen) {
      return;
    }

    const trimmedQuery = editorSearchQuery.trim();
    if (trimmedQuery.length < 2) {
      setEditorSearchResults([]);
      setEditorSearchError('');
      setEditorSearchLoading(false);
      return;
    }

    const handle = setTimeout(async () => {
      setEditorSearchLoading(true);
      setEditorSearchError('');
      try {
        const results = await courseOps.service.searchUsers(trimmedQuery, 25);
        setEditorSearchResults(results);
        setKnownUsers((prev) => {
          const next = new Map(prev);
          results.forEach((result) => next.set(result.id, result));
          return next;
        });
      } catch (error) {
        setEditorSearchError(error.message || 'Failed to search users');
      } finally {
        setEditorSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(handle);
  }, [editorSearchQuery, editorsDialogOpen, courseOps.service]);

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
        const user = knownUsers.get(userId);
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
        const user = knownUsers.get(userId);
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

  if (!user) {
    return null;
  }

  const editorVisible = user.isEditor(course.id);
  const selectedEditorUsers = selectedEditors.map((id) => knownUsers.get(id)).filter(Boolean);
  const editorsCount = selectedEditors.length;
  const openEditorsDialog = () => {
    setEditorsDialogOpen(true);
    editorsDialogRef.current?.showModal();
  };
  const closeEditorsDialog = () => {
    setEditorsDialogOpen(false);
    setEditorSearchQuery('');
    setEditorSearchResults([]);
    setEditorSearchError('');
    editorsDialogRef.current?.close();
  };
  const toggleEditorSelection = (userId) => {
    setSelectedEditors((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  };
  const isOriginalEditor = (userId) => ogSelectedEditorsRef.current.includes(userId);

  return (
    <div className="h-full overflow-auto p-4">
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
      <dialog ref={editorsDialogRef} className="w-full p-6 rounded-lg shadow-xl max-w-3xl mt-20 mx-auto" onCancel={closeEditorsDialog}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Manage editors</h3>
            <p className="text-xs text-gray-500">Add or remove editors. Changes are saved when you click Save changes.</p>
          </div>
          <button type="button" onClick={closeEditorsDialog} className="text-sm text-gray-500 hover:text-gray-700">
            Close
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-700">Current editors</h4>
              <span className="text-xs text-gray-500">{editorsCount} total</span>
            </div>
            <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto bg-white">
              {editorsLoading ? (
                <div className="p-4 text-sm text-gray-500">Loading editors…</div>
              ) : selectedEditorUsers.length > 0 ? (
                <ul className="divide-y divide-gray-100">
                  {selectedEditorUsers.map((editor) => (
                    <li key={editor.id} className="flex items-center justify-between px-3 py-2">
                      <div>
                        <div className="text-sm text-gray-800">{editor.name}</div>
                        <div className="text-xs text-gray-500">{editor.email}</div>
                        {!isOriginalEditor(editor.id) && <span className="text-[10px] uppercase text-blue-600">New</span>}
                      </div>
                      <button type="button" onClick={() => toggleEditorSelection(editor.id)} disabled={editorsCount <= 1} className="text-xs text-red-600 hover:text-red-700 disabled:text-gray-300">
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-4 text-sm text-gray-500">No editors selected.</div>
              )}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Find users</h4>
            <input type="text" value={editorSearchQuery} onChange={(e) => setEditorSearchQuery(e.target.value)} placeholder="Search by name or email" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
            <div className="mt-2 border border-gray-200 rounded-lg max-h-64 overflow-y-auto bg-white">
              {editorSearchLoading ? (
                <div className="p-4 text-sm text-gray-500">Searching…</div>
              ) : editorSearchError ? (
                <div className="p-4 text-sm text-red-600">{editorSearchError}</div>
              ) : editorSearchQuery.trim().length < 2 ? (
                <div className="p-4 text-sm text-gray-500">Type at least 2 characters to search.</div>
              ) : editorSearchResults.length > 0 ? (
                <ul className="divide-y divide-gray-100">
                  {editorSearchResults.map((result) => {
                    const isSelected = selectedEditors.includes(result.id);
                    return (
                      <li key={result.id} className="flex items-center justify-between px-3 py-2">
                        <div>
                          <div className="text-sm text-gray-800">{result.name}</div>
                          <div className="text-xs text-gray-500">{result.email}</div>
                        </div>
                        <button type="button" onClick={() => toggleEditorSelection(result.id)} className={`text-xs ${isSelected ? 'text-gray-500' : 'text-blue-600 hover:text-blue-700'}`}>
                          {isSelected ? 'Added' : 'Add'}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="p-4 text-sm text-gray-500">No users match your search.</div>
              )}
            </div>
          </div>
        </div>
      </dialog>
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
                <h2 className="text-lg font-semibold mb-3 text-gray-800">Editors</h2>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-700">
                      {editorsCount} editor{editorsCount === 1 ? '' : 's'} assigned
                    </div>
                  </div>
                  <button type="button" onClick={openEditorsDialog} className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-100">
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
    </div>
  );
}
