import React from 'react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, GripVertical, X } from 'lucide-react';
import Markdown from '../../components/Markdown';
import Splitter from '../Splitter.jsx';
import useSplitPaneState from '../../hooks/useSplitPaneState.jsx';
import { buildWeeks, parseScheduleMarkdown, serializeScheduleMarkdown } from '../../utils/scheduleMarkdown';

const NEW_SCHEDULE_OPTION = '__new_schedule__';
const ADD_ITEM_MENU_OPTION = '__add_item_menu__';
const NEW_MANUAL_ITEM_OPTION = '__new_manual_item__';

function createEmptyModel() {
  return {
    links: [],
    weeks: buildWeeks(1),
    specialDays: [],
  };
}

function dedupeScheduleFiles(files) {
  const seen = new Set();

  return (files || []).filter((file) => {
    if (!file) return false;

    const key = `${file.id || ''}::${file.path || file.repoPath || file.rawUrl || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

function resolveRelativeRepoPath(fromFileRepoPath, rawPath) {
  if (!fromFileRepoPath || !rawPath) {
    return '';
  }

  if (/^https?:\/\//i.test(rawPath)) {
    return '';
  }

  const baseDir = fromFileRepoPath.slice(0, Math.max(0, fromFileRepoPath.lastIndexOf('/')));
  const joined = rawPath.startsWith('/') ? rawPath.slice(1) : `${baseDir}/${rawPath}`;

  const normalized = [];
  joined.split('/').forEach((segment) => {
    if (!segment || segment === '.') {
      return;
    }
    if (segment === '..') {
      normalized.pop();
      return;
    }
    normalized.push(segment);
  });

  return normalized.join('/');
}

function buildScheduleTopicHref(topic, rawRoot, selectedFileRepoPath, courseId) {
  if (!topic) {
    return '';
  }

  const repoPath = repoRelativePathFromRawUrl(topic.path, rawRoot);
  if (repoPath && selectedFileRepoPath) {
    return relativePath(selectedFileRepoPath, repoPath);
  }

  if (topic.id && courseId) {
    return `/course/${courseId}/topic/${topic.id}`;
  }

  return '';
}

function normalizeWeekGroups(rows) {
  let previousWeek = null;
  let nextWeek = 0;

  return rows.map((row, index) => {
    if (index === 0 || row.week !== previousWeek) {
      nextWeek += 1;
    }
    previousWeek = row.week;
    return { ...row, week: nextWeek };
  });
}

function groupSessionsByWeek(rows) {
  const groups = [];
  rows.forEach((row) => {
    const last = groups[groups.length - 1];
    if (!last || last.week !== row.week) {
      groups.push({ week: row.week, sessions: [row] });
    } else {
      last.sessions.push(row);
    }
  });
  return groups;
}

function pickerValueFromTextDate(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  // Support schedule formats like "Tue Jan 13", "Jan 13", "Tue Jan 13 2027", "Jan 13 2027".
  const partsMatch = raw.match(/^(?:[A-Za-z]{3}\s+)?([A-Za-z]{3,9})\s+(\d{1,2})(?:\s+(\d{4}))?$/);
  if (partsMatch) {
    const monthText = partsMatch[1].slice(0, 3).toLowerCase();
    const day = Number(partsMatch[2]);
    const parsedYear = partsMatch[3] ? Number(partsMatch[3]) : NaN;
    const monthMap = {
      jan: 1,
      feb: 2,
      mar: 3,
      apr: 4,
      may: 5,
      jun: 6,
      jul: 7,
      aug: 8,
      sep: 9,
      oct: 10,
      nov: 11,
      dec: 12,
    };

    const month = monthMap[monthText];
    if (month && day >= 1 && day <= 31) {
      const year = Number.isFinite(parsedYear) ? parsedYear : new Date().getFullYear();
      const mm = String(month).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      return `${year}-${mm}-${dd}`;
    }
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return parsed.toISOString().slice(0, 10);
}

function textDateFromPickerValue(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  const parsed = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }

  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
    .format(parsed)
    .replace(',', '');
}

function parseScheduleDateTextToDate(value) {
  const iso = pickerValueFromTextDate(value);
  if (!iso) {
    return null;
  }

  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function formatScheduleDateFromDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
    .format(date)
    .replace(',', '');
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  next.setHours(0, 0, 0, 0);
  return next;
}

function remapScheduleDatesForStartDate(sourceModel, startDateIso) {
  const rawStart = String(startDateIso || '').trim();
  if (!rawStart) {
    return sourceModel;
  }

  const startDate = new Date(`${rawStart}T00:00:00`);
  if (Number.isNaN(startDate.getTime())) {
    return sourceModel;
  }
  startDate.setHours(0, 0, 0, 0);

  const rows = Array.isArray(sourceModel?.weeks) ? sourceModel.weeks : [];
  const parsedRows = rows.map((row) => ({ row, parsedDate: parseScheduleDateTextToDate(row?.date) }));
  const anchor = parsedRows.find((entry) => entry.parsedDate);

  if (!anchor?.parsedDate) {
    return sourceModel;
  }

  const dayShift = Math.round((startDate.getTime() - anchor.parsedDate.getTime()) / (24 * 60 * 60 * 1000));

  const nextWeeks = rows.map((row) => {
    const originalDate = parseScheduleDateTextToDate(row?.date);
    if (!originalDate) {
      return row;
    }

    return {
      ...row,
      date: formatScheduleDateFromDate(addDays(originalDate, dayShift)),
    };
  });

  return {
    ...sourceModel,
    weeks: nextWeeks,
  };
}

function SortableSessionCard({ row, sessionIndex, learningSession, selectedFileRepoPath, dueLinkedHrefs, coveredOrSlidesLinkedHrefs, updateWeek, removeSession, addTopicLink, addItem, updateItem, removeItem, getLinkedTopic }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id });
  const [editingItemKey, setEditingItemKey] = React.useState('');

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={`rounded border-l-4 border-l-blue-500 border border-blue-200 bg-blue-50/50 p-2 space-y-2 ${isDragging ? 'opacity-60' : ''}`}>
      <div className="grid grid-cols-1 gap-2 items-start sm:grid-cols-[90px_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
        <div className="w-[90px] whitespace-nowrap border border-blue-300 rounded px-2 py-1 text-xs bg-white text-blue-800 font-semibold text-center">Session {sessionIndex + 1}</div>
        <div className="min-w-0 flex items-center gap-2 sm:col-auto">
          <button type="button" {...attributes} {...listeners} className="inline-flex items-center justify-center rounded border border-gray-300 bg-white p-1 text-gray-500 hover:text-amber-600" title="Drag to reorder session">
            <GripVertical size={14} />
          </button>
          <input type="date" value={pickerValueFromTextDate(row.date)} onChange={(e) => updateWeek(row.id, { date: textDateFromPickerValue(e.target.value) })} className="min-w-0 w-full sm:w-[150px] border border-gray-300 rounded px-2 py-1 text-xs" />
        </div>
        <input className="min-w-0 w-full border border-gray-300 rounded px-2 py-1 text-xs" value={row.module} onChange={(e) => updateWeek(row.id, { module: e.target.value })} placeholder="Module" />
        <div className="flex justify-end items-center text-xs whitespace-nowrap sm:justify-end">
          <button type="button" className="inline-flex items-center justify-center text-blue-700 hover:text-red-600 transition-colors" onClick={() => removeSession(row.id)} title="Remove session" aria-label="Remove session">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {['dueItems', 'topicsCovered', 'slides'].map((field) => {
          const blockedHrefs = field === 'dueItems' ? dueLinkedHrefs : coveredOrSlidesLinkedHrefs;
          const availableTopics = (learningSession.course.allTopics || []).filter((topic) => {
            const href = buildScheduleTopicHref(topic, learningSession.course.links.gitHub.rawUrl, selectedFileRepoPath, learningSession.course.id);
            if (!href) {
              return false;
            }
            return !blockedHrefs.has(href);
          });

          return (
            <div key={field} className="border border-gray-200 rounded p-2 min-w-0">
              <div className="text-xs font-semibold text-gray-700 mb-1">{field === 'dueItems' ? 'Due' : field === 'topicsCovered' ? 'Topics' : 'Slides'}</div>

              <div className="flex flex-wrap gap-1">
                {row[field].map((item) =>
                  (() => {
                    const linkedTopic = getLinkedTopic(item.href);
                    const itemKey = `${field}:${item.id}`;
                    if (linkedTopic) {
                      return (
                        <div key={item.id} className="inline-flex items-center min-w-0 max-w-full border border-blue-300 bg-blue-50 rounded px-2 py-1 gap-2">
                          <a href={`/course/${learningSession.course.id}/topic/${linkedTopic.id}`} target="_blank" rel="noopener noreferrer" className="min-w-0 text-xs text-blue-700 hover:underline truncate whitespace-nowrap" title={`${linkedTopic.title} (open topic in new tab)`}>
                            {linkedTopic.title}
                          </a>
                          <button type="button" className="inline-flex items-center justify-center text-blue-700 hover:text-red-600 transition-colors shrink-0" onClick={() => removeItem(row.id, field, item.id)} title="Remove item" aria-label="Remove item">
                            <X size={12} />
                          </button>
                        </div>
                      );
                    }

                    const isEditing = editingItemKey === itemKey;
                    return (
                      <React.Fragment key={item.id}>
                        <div className="inline-flex items-center min-w-0 max-w-full border border-gray-300 bg-white rounded px-2 py-1 gap-2">
                          <button type="button" className="min-w-0 text-xs text-gray-700 truncate whitespace-nowrap" onClick={() => setEditingItemKey(isEditing ? '' : itemKey)} title="Edit item">
                            {(item.text || '').trim() || 'Custom item'}
                          </button>
                          <button type="button" className="inline-flex items-center justify-center text-blue-700 hover:text-red-600 transition-colors shrink-0" onClick={() => removeItem(row.id, field, item.id)} title="Remove item" aria-label="Remove item">
                            <X size={12} />
                          </button>
                        </div>
                        {isEditing && (
                          <div className="w-full grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_24px] gap-2 items-center border border-gray-200 rounded p-2 bg-white/70">
                            <input value={item.text || ''} onChange={(e) => updateItem(row.id, field, item.id, { text: e.target.value })} placeholder="Text" className="min-w-0 border border-gray-300 bg-white rounded px-2 py-1 text-xs" />
                            <input value={item.href || ''} onChange={(e) => updateItem(row.id, field, item.id, { href: e.target.value })} placeholder="Link (optional)" className="min-w-0 border border-gray-300 bg-white rounded px-2 py-1 text-xs" />
                            <button type="button" className="w-6 h-6 inline-flex items-center justify-center text-blue-700 hover:text-green-700 transition-colors" onClick={() => setEditingItemKey('')} title="Apply changes" aria-label="Apply changes">
                              <Check size={12} />
                            </button>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })(),
                )}
                <select
                  className="w-8 h-7 text-sm font-semibold text-blue-700 border border-blue-300 rounded bg-white text-center px-0"
                  defaultValue={ADD_ITEM_MENU_OPTION}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === ADD_ITEM_MENU_OPTION) {
                      return;
                    }

                    if (value === NEW_MANUAL_ITEM_OPTION) {
                      addItem(row.id, field, { id: `item-${Date.now()}`, text: '', href: '' });
                    } else {
                      addTopicLink(row.id, field, value);
                    }
                    e.currentTarget.value = ADD_ITEM_MENU_OPTION;
                  }}
                  title="Add item"
                >
                  <option value={ADD_ITEM_MENU_OPTION}>+</option>
                  <option value={NEW_MANUAL_ITEM_OPTION}>Custom item...</option>
                  {availableTopics.length > 0 && <option disabled>──────────</option>}
                  {availableTopics.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
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
  const [newScheduleTitle, setNewScheduleTitle] = React.useState('');
  const [newScheduleSourceId, setNewScheduleSourceId] = React.useState('');
  const [newScheduleStartDate, setNewScheduleStartDate] = React.useState('');
  const newScheduleDialogRef = React.useRef(null);
  const { panePercent: editorPanePercent, splitContainerRef, onPaneMoved: onEditorPaneMoved, onPaneResized: onEditorPaneResized } = useSplitPaneState(55);
  const previewMarkdown = React.useMemo(() => serializeScheduleMarkdown(model), [model]);

  React.useEffect(() => {
    const topic = learningSession?.topic;
    if (!topic) return;

    const scheduleFiles = dedupeScheduleFiles(courseOps.getScheduleFiles(topic));
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
    const maxWeek = model.weeks.reduce((max, row) => Math.max(max, Number(row.week) || 0), 0);
    const row = {
      id: `week-${Date.now()}`,
      week: maxWeek + 1,
      date: '',
      module: '',
      dueItems: [],
      topicsCovered: [],
      slides: [],
    };
    updateModel({ ...model, weeks: normalizeWeekGroups([...model.weeks, row]) });
  }

  function addSession(weekNumber) {
    const insertAfterIndex = (() => {
      let idx = -1;
      for (let i = 0; i < model.weeks.length; i += 1) {
        if (model.weeks[i].week === weekNumber) {
          idx = i;
        } else if (idx >= 0) {
          break;
        }
      }
      return idx;
    })();

    if (insertAfterIndex < 0) {
      return;
    }

    const row = {
      id: `week-${Date.now()}-${insertAfterIndex}`,
      week: weekNumber,
      date: '',
      module: '',
      dueItems: [],
      topicsCovered: [],
      slides: [],
    };
    const nextWeeks = [...model.weeks];
    nextWeeks.splice(insertAfterIndex + 1, 0, row);
    updateModel({ ...model, weeks: normalizeWeekGroups(nextWeeks) });
  }

  function removeSession(rowId) {
    const nextWeeks = model.weeks.filter((row) => row.id !== rowId);
    updateModel({ ...model, weeks: nextWeeks.length ? normalizeWeekGroups(nextWeeks) : buildWeeks(1) });
  }

  function removeWeek(weekNumber) {
    const nextWeeks = model.weeks.filter((row) => row.week !== weekNumber);
    updateModel({ ...model, weeks: nextWeeks.length ? normalizeWeekGroups(nextWeeks) : buildWeeks(1) });
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

    const href = buildScheduleTopicHref(topic, learningSession.course.links.gitHub.rawUrl, selectedFile.repoPath, learningSession.course.id);
    if (!href) return;

    const sectionGroup = field === 'dueItems' ? ['dueItems'] : ['topicsCovered', 'slides'];
    const hrefAlreadyLinked = (model.weeks || []).some((row) => sectionGroup.some((section) => (row[section] || []).some((item) => item?.href === href)));
    if (hrefAlreadyLinked) {
      return;
    }

    addItem(rowId, field, {
      id: `item-${Date.now()}`,
      text: topic.title,
      href,
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

  async function createSchedule(title, sourceFileId = '', startDateIso = '') {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || creatingSchedule) {
      return;
    }

    if (dirty && !window.confirm('Discard unsaved schedule changes before creating another schedule?')) {
      return;
    }

    let copiedMarkdown = '';
    if (sourceFileId) {
      let sourceModel = null;
      if (sourceFileId === selectedFileId) {
        sourceModel = { ...createEmptyModel(), ...model };
      } else {
        const sourceMarkdown = await courseOps.getScheduleTopicContent(learningSession.topic, sourceFileId, true);
        const parsed = parseScheduleMarkdown(sourceMarkdown || '');
        sourceModel = { ...createEmptyModel(), ...parsed };
      }

      const remappedModel = remapScheduleDatesForStartDate(sourceModel, startDateIso);
      copiedMarkdown = serializeScheduleMarkdown({ ...remappedModel, docTitle: trimmedTitle });
    }

    setCreatingSchedule(true);
    try {
      const createdFile = await courseOps.createScheduleFile(learningSession.topic, trimmedTitle);
      if (createdFile) {
        if (copiedMarkdown) {
          await courseOps.updateScheduleTopicContent(learningSession.topic, createdFile.id, copiedMarkdown, `copy(schedule) ${trimmedTitle}`);
        }
        setFiles((prev) => dedupeScheduleFiles([...prev, createdFile]));
        setSelectedFileId(createdFile.id);
      }
    } catch (error) {
      alert(error.message || 'Unable to create schedule file.');
    } finally {
      setCreatingSchedule(false);
    }
  }

  async function promptAndCreateSchedule() {
    setNewScheduleTitle('');
    setNewScheduleSourceId(selectedFileId || '');
    setNewScheduleStartDate('');
    newScheduleDialogRef.current?.showModal();
  }

  function cancelNewScheduleDialog() {
    newScheduleDialogRef.current?.close();
    setNewScheduleTitle('');
    setNewScheduleSourceId('');
    setNewScheduleStartDate('');
  }

  async function confirmNewScheduleDialog() {
    const title = newScheduleTitle.trim();
    if (!title || creatingSchedule) {
      return;
    }

    await createSchedule(title, newScheduleSourceId, newScheduleStartDate);
    cancelNewScheduleDialog();
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

  const weekGroups = groupSessionsByWeek(model.weeks || []);
  const topicByRepoPath = React.useMemo(() => {
    const entries = new Map();
    const rawRoot = learningSession?.course?.links?.gitHub?.rawUrl;
    (learningSession?.course?.allTopics || []).forEach((topic) => {
      const repoPath = repoRelativePathFromRawUrl(topic.path, rawRoot);
      if (repoPath) {
        entries.set(repoPath, topic);
      }
    });
    return entries;
  }, [learningSession?.course]);

  const dueLinkedHrefs = React.useMemo(() => {
    const hrefs = new Set();
    (model.weeks || []).forEach((row) => {
      (row.dueItems || []).forEach((item) => {
        if (item?.href) {
          hrefs.add(item.href);
        }
      });
    });
    return hrefs;
  }, [model.weeks]);

  const coveredOrSlidesLinkedHrefs = React.useMemo(() => {
    const hrefs = new Set();
    (model.weeks || []).forEach((row) => {
      ['topicsCovered', 'slides'].forEach((field) => {
        (row[field] || []).forEach((item) => {
          if (item?.href) {
            hrefs.add(item.href);
          }
        });
      });
    });
    return hrefs;
  }, [model.weeks]);

  function getLinkedTopic(itemHref) {
    if (!itemHref) {
      return null;
    }

    const internalTopicRouteMatch = itemHref.match(/^\/course\/[^/]+\/topic\/([^/?#]+)/);
    if (internalTopicRouteMatch?.[1]) {
      return learningSession?.course?.topicFromId(internalTopicRouteMatch[1]) || null;
    }

    if (!selectedFile?.repoPath) {
      return null;
    }

    const repoPath = resolveRelativeRepoPath(selectedFile.repoPath, itemHref);
    if (!repoPath) {
      return null;
    }

    return topicByRepoPath.get(repoPath) || null;
  }

  function handleSessionDragEnd(event) {
    const { active, over } = event;
    if (!active || !over || active.id === over.id) {
      return;
    }

    const rows = model.weeks || [];
    const oldIndex = rows.findIndex((row) => row.id === active.id);
    const newIndex = rows.findIndex((row) => row.id === over.id);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    const targetWeek = rows[newIndex].week;
    const reordered = arrayMove(rows, oldIndex, newIndex).map((row) => {
      if (row.id !== active.id) {
        return row;
      }
      return { ...row, week: targetWeek };
    });

    updateModel({ ...model, weeks: normalizeWeekGroups(reordered) });
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="basis-[47px] p-2 flex items-center justify-between border-b border-gray-200">
        <h1 className="text-lg font-bold text-gray-800">
          Editor <sup className="inline-block w-[1ch] text-center">{dirty ? '*' : ''}</sup>
        </h1>
        <div className="flex items-center gap-2">
          <select value={selectedFileId} onChange={handleFileChange} className="border border-gray-300 rounded px-2 py-1 text-sm">
            {files.map((file) => (
              <option key={file.id} value={file.id}>
                {file.title}
              </option>
            ))}
            <option value={NEW_SCHEDULE_OPTION}>+ New schedule...</option>
          </select>
          <button className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 text-xs" onClick={discard} disabled={!dirty || committing}>
            Discard
          </button>
          <button className="w-[96px] px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 text-xs inline-flex items-center justify-center gap-2" onClick={commit} disabled={!dirty || committing}>
            {committing && <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
            <span>Commit</span>
          </button>
          <button className="px-3 py-1 bg-blue-400 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 text-xs" onClick={setDefaultSchedule} disabled={!selectedFile || selectedFile.default || settingDefault}>
            {settingDefault ? 'Updating...' : 'Default'}
          </button>
          <button className="px-3 py-1 bg-red-700 text-white rounded hover:bg-red-800 disabled:bg-gray-400 text-xs" onClick={deleteSchedule} disabled={!selectedFile || selectedFile.default || deletingSchedule}>
            {deletingSchedule ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-4">
        <div className="flex h-full overflow-hidden min-w-0 border border-gray-200 rounded" ref={splitContainerRef}>
          <div className="h-full overflow-auto min-w-0 shrink-0 p-4" style={{ width: `${editorPanePercent}%` }}>
            <div className="space-y-6">
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
                    <button className="text-xs text-blue-700" onClick={() => updateModel({ ...model, links: model.links.filter((_, i) => i !== index) })}>
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
                </div>

                <DndContext collisionDetection={closestCenter} onDragEnd={handleSessionDragEnd}>
                  <SortableContext items={(model.weeks || []).map((row) => row.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-4">
                      {weekGroups.map((group) => (
                        <div key={`week-group-${group.week}`} className="rounded-lg border-2 border-gray-300 bg-gray-50 p-3 space-y-3 shadow-sm">
                          <div className="flex items-center justify-between border-b border-gray-300 pb-2">
                            <div className="inline-flex items-center rounded-full bg-blue-700 px-3 py-1 text-xs font-semibold text-white">Week {group.week}</div>
                            <div className="flex items-center gap-3 text-xs">
                              <button type="button" className="inline-flex items-center justify-center text-blue-700 hover:text-red-600 transition-colors" onClick={() => removeWeek(group.week)} title="Remove week" aria-label="Remove week">
                                <X size={14} />
                              </button>
                            </div>
                          </div>

                          <div className="space-y-3">
                            {group.sessions.map((row, sessionIndex) => (
                              <SortableSessionCard key={row.id} row={row} sessionIndex={sessionIndex} learningSession={learningSession} selectedFileRepoPath={selectedFile?.repoPath || ''} dueLinkedHrefs={dueLinkedHrefs} coveredOrSlidesLinkedHrefs={coveredOrSlidesLinkedHrefs} updateWeek={updateWeek} removeSession={removeSession} addTopicLink={addTopicLink} addItem={addItem} updateItem={updateItem} removeItem={removeItem} getLinkedTopic={getLinkedTopic} />
                            ))}
                          </div>

                          <button className="text-xs text-blue-700" onClick={() => addSession(group.week)}>
                            + Add session
                          </button>
                        </div>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
                <button className="text-xs text-blue-700" onClick={addWeek}>
                  + Add week
                </button>
              </section>

              <section className="space-y-2">
                <h2 className="text-sm font-semibold text-gray-700">Special days</h2>
                {model.specialDays.map((day, index) => (
                  <div key={day.id || index} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-3 min-w-0 flex items-center gap-2">
                      <input type="date" value={pickerValueFromTextDate(day.dateText)} onChange={(e) => updateSpecialDay(index, { dateText: textDateFromPickerValue(e.target.value) })} className="w-[150px] border border-gray-300 rounded px-2 py-1 text-sm" />
                    </div>
                    <input value={day.label || ''} onChange={(e) => updateSpecialDay(index, { label: e.target.value })} placeholder="Label" className="col-span-4 border border-gray-300 rounded px-2 py-1 text-sm" />
                    <input value={day.notes || ''} onChange={(e) => updateSpecialDay(index, { notes: e.target.value })} placeholder="Notes" className="col-span-4 border border-gray-300 rounded px-2 py-1 text-sm" />
                    <button className="col-span-1 text-xs text-blue-700" onClick={() => updateModel({ ...model, specialDays: model.specialDays.filter((_, i) => i !== index) })}>
                      Remove
                    </button>
                  </div>
                ))}
                <button className="text-xs text-blue-700" onClick={() => updateModel({ ...model, specialDays: [...model.specialDays, { id: `sd-${Date.now()}`, dateText: '', label: '', notes: '' }] })}>
                  + Add special day
                </button>
              </section>
            </div>
          </div>

          <Splitter onMove={onEditorPaneMoved} onResized={onEditorPaneResized} minPosition={0} maxPosition={window.innerWidth} />

          <div className="h-full flex-1 min-w-0 overflow-auto border-l border-gray-200 bg-white">
            <div className="markdown-body p-4">
              <Markdown learningSession={learningSession} content={previewMarkdown} />
            </div>
          </div>
        </div>
      </div>

      <dialog ref={newScheduleDialogRef} className="w-full p-6 rounded-lg shadow-lg max-w-md mt-20 mx-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-amber-500 mb-4">New schedule</h2>
        <div className="mb-2 text-gray-700">Enter a title for the new schedule.</div>
        <input type="text" value={newScheduleTitle} onChange={(e) => setNewScheduleTitle(e.target.value)} placeholder="Schedule title" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent mb-4" />

        <div className="mb-2 text-gray-700">Create from</div>
        <select value={newScheduleSourceId} onChange={(e) => setNewScheduleSourceId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4">
          <option value="">Blank schedule</option>
          {files.map((file) => (
            <option key={file.id} value={file.id}>
              {file.title}
            </option>
          ))}
        </select>

        {newScheduleSourceId && (
          <>
            <label htmlFor="new-schedule-start-date" className="mb-2 block text-gray-700">
              First session date (optional)
            </label>
            <input id="new-schedule-start-date" type="date" value={newScheduleStartDate} onChange={(e) => setNewScheduleStartDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4" />
          </>
        )}

        <div className="flex justify-end gap-3">
          <button onClick={cancelNewScheduleDialog} className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors" disabled={creatingSchedule}>
            Cancel
          </button>
          <button onClick={confirmNewScheduleDialog} disabled={!newScheduleTitle.trim() || creatingSchedule} className="px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors">
            {creatingSchedule ? 'Creating...' : 'Create'}
          </button>
        </div>
      </dialog>
    </div>
  );
}
