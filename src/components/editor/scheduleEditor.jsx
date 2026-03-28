import React from 'react';
import { buildWeeks, parseScheduleMarkdown, serializeScheduleMarkdown } from '../../utils/scheduleMarkdown';
import InputDialog from '../../hooks/inputDialog.jsx';

const NEW_SCHEDULE_OPTION = '__new_schedule__';

function createEmptyModel() {
  return {
    docTitle: 'Schedule',
    links: [],
    weeks: buildWeeks(1),
    specialDays: [],
  };
}

function repoRelativePathFromRawUrl(rawUrl, rawRoot) {
  if (!rawUrl || !rawRoot || !rawUrl.startsWith(rawRoot)) {
    return '';
  }

  return rawUrl.slice(rawRoot.length + 1);
}

function relativePath(fromFileRepoPath, toFileRepoPath) {
  const fromParts = fromFileRepoPath.split('/').filter(Boolean);
  const toParts = toFileRepoPath.split('/').filter(Boolean);

  fromParts.pop();

  let i = 0;
  while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) {
    i += 1;
  }

  const up = fromParts.length - i;
  const down = toParts.slice(i);

  const prefix = up > 0 ? '../'.repeat(up) : './';
  return `${prefix}${down.join('/')}`;
}

export default function ScheduleEditor({ courseOps, learningSession }) {
  const [files, setFiles] = React.useState([]);
  const [selectedFileId, setSelectedFileId] = React.useState('');
  const [selectedFile, setSelectedFile] = React.useState(null);
  const [creatingSchedule, setCreatingSchedule] = React.useState(false);
  const [deletingSchedule, setDeletingSchedule] = React.useState(false);
  const [settingDefault, setSettingDefault] = React.useState(false);
  const [model, setModel] = React.useState(createEmptyModel());
  const [dirty, setDirty] = React.useState(false);
  const [committing, setCommitting] = React.useState(false);
  const newScheduleDialogRef = React.useRef(null);

  React.useEffect(() => {
    const topic = learningSession?.topic;
    if (!topic) return;

    const scheduleFiles = courseOps.getScheduleFiles(topic);
    const activeFile = courseOps.getSelectedScheduleFile(topic, scheduleFiles);

    setFiles(scheduleFiles);
    setSelectedFileId(activeFile?.id || '');
  }, [learningSession?.topic]);

  React.useEffect(() => {
    if (!selectedFileId || !learningSession?.topic) {
      return;
    }

    const activeFile = files.find((file) => file.id === selectedFileId);
    setSelectedFile(activeFile || null);

    courseOps.getScheduleTopicContent(learningSession.topic, selectedFileId).then((markdown) => {
      const parsed = parseScheduleMarkdown(markdown || '');
      setModel({ ...createEmptyModel(), ...parsed });
      setDirty(false);
    });
  }, [selectedFileId, files, learningSession?.topic]);

  function updateModel(nextModel) {
    setModel(nextModel);
    setDirty(true);
  }

  function updateWeek(rowId, patch) {
    const nextWeeks = model.weeks.map((row) => (row.id === rowId ? { ...row, ...patch } : row));
    updateModel({ ...model, weeks: nextWeeks });
  }

  function addWeek() {
    const row = {
      id: `week-${Date.now()}`,
      week: model.weeks.length + 1,
      date: '',
      module: '',
      dueItems: [],
      topicsCovered: [],
      slides: [],
    };
    updateModel({ ...model, weeks: [...model.weeks, row] });
  }

  function insertWeek(afterIndex) {
    const row = {
      id: `week-${Date.now()}-${afterIndex}`,
      week: '',
      date: '',
      module: '',
      dueItems: [],
      topicsCovered: [],
      slides: [],
    };
    const nextWeeks = [...model.weeks];
    nextWeeks.splice(afterIndex + 1, 0, row);
    updateModel({ ...model, weeks: nextWeeks });
  }

  function removeWeek(rowId) {
    const nextWeeks = model.weeks.filter((row) => row.id !== rowId);
    updateModel({ ...model, weeks: nextWeeks.length ? nextWeeks : buildWeeks(1) });
  }

  function updateLinks(index, patch) {
    const next = [...model.links];
    next[index] = { ...next[index], ...patch };
    updateModel({ ...model, links: next });
  }

  function updateSpecialDay(index, patch) {
    const next = [...model.specialDays];
    next[index] = { ...next[index], ...patch };
    updateModel({ ...model, specialDays: next });
  }

  function addItem(rowId, field, item) {
    const nextWeeks = model.weeks.map((row) => {
      if (row.id !== rowId) return row;
      return {
        ...row,
        [field]: [...row[field], item],
      };
    });
    updateModel({ ...model, weeks: nextWeeks });
  }

  function removeItem(rowId, field, itemId) {
    const nextWeeks = model.weeks.map((row) => {
      if (row.id !== rowId) return row;
      return {
        ...row,
        [field]: row[field].filter((item) => item.id !== itemId),
      };
    });
    updateModel({ ...model, weeks: nextWeeks });
  }

  function updateItem(rowId, field, itemId, patch) {
    const nextWeeks = model.weeks.map((row) => {
      if (row.id !== rowId) return row;
      return {
        ...row,
        [field]: row[field].map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
      };
    });
    updateModel({ ...model, weeks: nextWeeks });
  }

  function addTopicLink(rowId, field, topicId) {
    const topic = learningSession.course.topicFromId(topicId);
    if (!topic || !selectedFile) return;

    const toRepoPath = repoRelativePathFromRawUrl(topic.path, learningSession.course.links.gitHub.rawUrl);
    if (!toRepoPath) return;

    const href = relativePath(selectedFile.repoPath, toRepoPath);
    addItem(rowId, field, {
      id: `item-${Date.now()}`,
      text: topic.title,
      href,
      checked: false,
    });
  }

  async function commit() {
    if (!selectedFile || committing) {
      return;
    }

    setCommitting(true);
    try {
      const markdown = serializeScheduleMarkdown(model);
      await courseOps.updateScheduleTopicContent(learningSession.topic, selectedFileId, markdown);
      setDirty(false);
    } finally {
      setCommitting(false);
    }
  }

  async function discard() {
    if (!selectedFileId) {
      return;
    }

    const markdown = await courseOps.getScheduleTopicContent(learningSession.topic, selectedFileId, true);
    setModel({ ...createEmptyModel(), ...parseScheduleMarkdown(markdown || '') });
    setDirty(false);
  }

  async function handleFileChange(event) {
    const nextId = event.target.value;
    if (nextId === NEW_SCHEDULE_OPTION) {
      await promptAndCreateSchedule();
      return;
    }

    if (dirty && !window.confirm('Discard unsaved schedule changes?')) {
      return;
    }

    setSelectedFileId(nextId);
    courseOps.setSelectedScheduleFile(learningSession.topic, nextId);
  }

  async function createSchedule(title) {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || creatingSchedule) {
      return;
    }

    if (dirty && !window.confirm('Discard unsaved schedule changes before creating another schedule?')) {
      return;
    }

    setCreatingSchedule(true);
    try {
      const createdFile = await courseOps.createScheduleFile(learningSession.topic, trimmedTitle);
      if (createdFile) {
        setFiles((prev) => [...prev, createdFile]);
        setSelectedFileId(createdFile.id);
      }
    } catch (error) {
      alert(error.message || 'Unable to create schedule file.');
    } finally {
      setCreatingSchedule(false);
    }
  }

  async function promptAndCreateSchedule() {
    const title = await newScheduleDialogRef.current?.show({
      title: 'New schedule',
      description: 'Enter a title for the new schedule.',
      placeholder: 'Schedule title',
      confirmButtonText: 'Create',
      cancelButtonText: 'Cancel',
    });

    if (!title) {
      return;
    }

    await createSchedule(title);
  }

  async function deleteSchedule() {
    if (!selectedFile || deletingSchedule) {
      return;
    }

    if (dirty && !window.confirm('Discard unsaved schedule content changes before deleting this schedule file?')) {
      return;
    }

    if (!window.confirm(`Delete schedule file '${selectedFile.title}'?`)) {
      return;
    }

    setDeletingSchedule(true);
    try {
      const nextFileId = await courseOps.deleteScheduleFile(learningSession.topic, selectedFile.id);
      if (nextFileId) {
        setSelectedFileId(nextFileId);
      }
    } catch (error) {
      alert(error.message || 'Unable to delete schedule file.');
    } finally {
      setDeletingSchedule(false);
    }
  }

  async function setDefaultSchedule() {
    if (!selectedFile || settingDefault) {
      return;
    }

    setSettingDefault(true);
    try {
      await courseOps.setDefaultScheduleFile(learningSession.topic, selectedFile.id);
    } catch (error) {
      alert(error.message || 'Unable to set default schedule file.');
    } finally {
      setSettingDefault(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="basis-[47px] p-2 flex items-center justify-between border-b border-gray-200">
        <h1 className="text-lg font-bold text-gray-800">
          Editor <sup className="inline-block w-[1ch] text-center">{dirty ? '*' : ''}</sup>
        </h1>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-700 flex items-center gap-1">
            File
            <select value={selectedFileId} onChange={handleFileChange} className="border border-gray-300 rounded px-2 py-1 text-sm">
              {files.map((file) => (
                <option key={file.id} value={file.id}>
                  {file.title}
                </option>
              ))}
              <option value={NEW_SCHEDULE_OPTION}>+ New schedule...</option>
            </select>
          </label>
          <button className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 text-xs" onClick={discard} disabled={!dirty || committing}>
            Discard
          </button>
          <button className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 text-xs" onClick={commit} disabled={!dirty || committing}>
            {committing ? 'Committing...' : 'Commit'}
          </button>
          <button className="px-3 py-1 bg-blue-400 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 text-xs" onClick={setDefaultSchedule} disabled={!selectedFile || selectedFile.default || settingDefault}>
            {settingDefault ? 'Updating...' : 'Default'}
          </button>
          <button className="px-3 py-1 bg-red-700 text-white rounded hover:bg-red-800 disabled:bg-gray-400 text-xs" onClick={deleteSchedule} disabled={!selectedFile || selectedFile.id === 'default' || deletingSchedule}>
            {deletingSchedule ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-6">
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-700">Title</h2>
          <input value={model.docTitle} onChange={(e) => updateModel({ ...model, docTitle: e.target.value })} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-700">External links</h2>
          {model.links.map((link, index) => (
            <div key={link.id || index} className="flex gap-2 items-center">
              <input value={link.label || ''} onChange={(e) => updateLinks(index, { label: e.target.value })} placeholder="Label" className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm" />
              <input value={link.url || ''} onChange={(e) => updateLinks(index, { url: e.target.value })} placeholder="URL" className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm" />
              <button className="text-xs text-red-700" onClick={() => updateModel({ ...model, links: model.links.filter((_, i) => i !== index) })}>
                Remove
              </button>
            </div>
          ))}
          <button className="text-xs text-blue-700" onClick={() => updateModel({ ...model, links: [...model.links, { id: `link-${Date.now()}`, label: '', url: '' }] })}>
            + Add link
          </button>
        </section>

        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-700">Weeks</h2>
            <button className="text-xs text-blue-700" onClick={addWeek}>
              + Add week
            </button>
          </div>

          <div className="space-y-3">
            {model.weeks.map((row, index) => (
              <div key={row.id} className="border border-gray-300 rounded p-3 space-y-2">
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-1 border border-gray-300 rounded px-2 py-1 text-xs bg-gray-50 text-gray-700">{index + 1}</div>
                  <input className="col-span-3 border border-gray-300 rounded px-2 py-1 text-xs" value={row.date} onChange={(e) => updateWeek(row.id, { date: e.target.value })} placeholder="Date" />
                  <input className="col-span-4 border border-gray-300 rounded px-2 py-1 text-xs" value={row.module} onChange={(e) => updateWeek(row.id, { module: e.target.value })} placeholder="Module" />
                  <div className="col-span-4 flex justify-end gap-2 text-xs">
                    <button className="text-blue-700" onClick={() => insertWeek(index)}>
                      Insert below
                    </button>
                    <button className="text-red-700" onClick={() => removeWeek(row.id)}>
                      Remove
                    </button>
                  </div>
                </div>

                {['dueItems', 'topicsCovered', 'slides'].map((field) => (
                  <div key={field} className="border border-gray-200 rounded p-2">
                    <div className="flex justify-between items-center mb-1">
                      <div className="text-xs font-semibold text-gray-700">{field === 'dueItems' ? 'Due' : field === 'topicsCovered' ? 'Topics Covered' : 'Slides'}</div>
                      <div className="flex items-center gap-2">
                        <select className="text-xs border border-gray-300 rounded px-1 py-0.5" defaultValue="" onChange={(e) => addTopicLink(row.id, field, e.target.value)}>
                          <option value="" disabled>
                            Add topic link...
                          </option>
                          {learningSession.course.allTopics.map((topic) => (
                            <option key={topic.id} value={topic.id}>
                              {topic.title}
                            </option>
                          ))}
                        </select>
                        <button className="text-xs text-blue-700" onClick={() => addItem(row.id, field, { id: `item-${Date.now()}`, text: '', href: '', checked: false })}>
                          + Item
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      {row[field].map((item) => (
                        <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                          <input type="checkbox" checked={Boolean(item.checked)} onChange={(e) => updateItem(row.id, field, item.id, { checked: e.target.checked })} className="col-span-1" />
                          <input value={item.text || ''} onChange={(e) => updateItem(row.id, field, item.id, { text: e.target.value })} placeholder="Text" className="col-span-4 border border-gray-300 rounded px-2 py-1 text-xs" />
                          <input value={item.href || ''} onChange={(e) => updateItem(row.id, field, item.id, { href: e.target.value })} placeholder="Link (optional)" className="col-span-6 border border-gray-300 rounded px-2 py-1 text-xs" />
                          <button className="col-span-1 text-red-700 text-xs" onClick={() => removeItem(row.id, field, item.id)}>
                            x
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-700">Special days</h2>
          {model.specialDays.map((day, index) => (
            <div key={day.id || index} className="grid grid-cols-12 gap-2 items-center">
              <input value={day.dateText || ''} onChange={(e) => updateSpecialDay(index, { dateText: e.target.value })} placeholder="Date" className="col-span-3 border border-gray-300 rounded px-2 py-1 text-sm" />
              <input value={day.label || ''} onChange={(e) => updateSpecialDay(index, { label: e.target.value })} placeholder="Label" className="col-span-4 border border-gray-300 rounded px-2 py-1 text-sm" />
              <input value={day.notes || ''} onChange={(e) => updateSpecialDay(index, { notes: e.target.value })} placeholder="Notes" className="col-span-4 border border-gray-300 rounded px-2 py-1 text-sm" />
              <button className="col-span-1 text-xs text-red-700" onClick={() => updateModel({ ...model, specialDays: model.specialDays.filter((_, i) => i !== index) })}>
                Remove
              </button>
            </div>
          ))}
          <button className="text-xs text-blue-700" onClick={() => updateModel({ ...model, specialDays: [...model.specialDays, { id: `sd-${Date.now()}`, dateText: '', label: '', notes: '' }] })}>
            + Add special day
          </button>
        </section>
      </div>

      <InputDialog dialogRef={newScheduleDialogRef} />
    </div>
  );
}
