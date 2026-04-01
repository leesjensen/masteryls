import React from 'react';
import useModuleState from './hooks/useModuleState';
import ModuleSection from './components/ModuleSection';
import NewModuleButton from './components/NewModuleButton';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import Course from './course.js';
import { useProgress } from './contexts/ProgressContext.jsx';
import { parseScheduleMarkdown } from './utils/scheduleMarkdown.js';
import { useNavigate } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';

function repoRelativePathFromRawUrl(rawUrl, rawRoot) {
  if (!rawUrl || !rawRoot || !rawUrl.startsWith(rawRoot)) {
    return '';
  }

  return rawUrl.slice(rawRoot.length + 1);
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

function formatDueLabel(dates) {
  const compactDates = [];
  dates.forEach((dateText) => {
    const raw = String(dateText || '').trim();
    if (!raw) {
      return;
    }

    // Schedule rows are commonly stored as "Tue Jan 8" or "Tue Jan 8 2026".
    const partsMatch = raw.match(/^(?:[A-Za-z]{3}\s+)?([A-Za-z]{3,9})\s+(\d{1,2})(?:,?\s+\d{4})?$/);
    if (partsMatch) {
      compactDates.push(`${partsMatch[1].slice(0, 3)} ${Number(partsMatch[2])}`);
      return;
    }

    // Support ISO and long-form textual dates like "Sat Apr 4, 2026".
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T00:00:00`) : new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      compactDates.push(new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(parsed));
      return;
    }

    compactDates.push(raw);
  });

  const uniqueDates = compactDates.filter((date, index) => compactDates.indexOf(date) === index);

  if (!uniqueDates.length) {
    return '';
  }

  if (uniqueDates.length === 1) {
    return uniqueDates[0];
  }

  return `${uniqueDates[0]} (+${uniqueDates.length - 1})`;
}

function Contents({ courseOps, learningSession, editorVisible }) {
  const navigate = useNavigate();
  const { openModuleIndexes, toggleModule } = useModuleState(courseOps, learningSession?.course, learningSession?.topic);
  const { showProgress, updateProgress, hideProgress } = useProgress();
  const [dueDatesByTopicId, setDueDatesByTopicId] = React.useState({});

  const scheduleTopic = courseOps.getScheduleTopic(learningSession?.course);
  const scheduleFiles = scheduleTopic ? courseOps.getScheduleFiles(scheduleTopic) : [];
  const selectedScheduleFile = scheduleTopic ? courseOps.getSelectedScheduleFile(scheduleTopic, scheduleFiles) : null;

  React.useEffect(() => {
    let active = true;

    async function syncDueDates() {
      if (!learningSession?.course || !scheduleTopic || !selectedScheduleFile) {
        if (active) {
          setDueDatesByTopicId({});
        }
        return;
      }

      const markdown = await courseOps.getScheduleTopicContent(scheduleTopic, selectedScheduleFile.id);
      if (!active) {
        return;
      }

      const model = parseScheduleMarkdown(markdown || '');
      const topicByRepoPath = new Map();
      const topicByTitle = new Map();
      const rawRoot = learningSession.course.links?.gitHub?.rawUrl;

      learningSession.course.allTopics.forEach((topic) => {
        const repoPath = repoRelativePathFromRawUrl(topic.path, rawRoot);
        if (repoPath) {
          topicByRepoPath.set(repoPath, topic.id);
        }

        if (topic.title) {
          topicByTitle.set(topic.title.trim().toLowerCase(), topic.id);
        }
      });

      const dueMap = new Map();
      const rows = Array.isArray(model?.weeks) ? model.weeks : [];
      rows.forEach((row) => {
        const date = String(row?.date || '').trim();
        if (!date) {
          return;
        }

        const dueItems = Array.isArray(row?.dueItems) ? row.dueItems : [];
        dueItems.forEach((item) => {
          const href = String(item?.href || '').trim();
          const text = String(item?.text || '').trim();

          let topicId = null;
          if (href) {
            const repoPath = resolveRelativeRepoPath(selectedScheduleFile.repoPath, href);
            topicId = topicByRepoPath.get(repoPath) || null;
          }

          if (!topicId && text) {
            topicId = topicByTitle.get(text.toLowerCase()) || null;
          }

          if (!topicId) {
            return;
          }

          if (!dueMap.has(topicId)) {
            dueMap.set(topicId, []);
          }

          const existing = dueMap.get(topicId);
          if (!existing.includes(date)) {
            existing.push(date);
          }
        });
      });

      const nextDueDates = {};
      dueMap.forEach((dates, topicId) => {
        const label = formatDueLabel(dates);
        if (label) {
          nextDueDates[topicId] = label;
        }
      });

      setDueDatesByTopicId(nextDueDates);
    }

    syncDueDates().catch(() => {
      if (active) {
        setDueDatesByTopicId({});
      }
    });

    return () => {
      active = false;
    };
  }, [courseOps, learningSession?.course, scheduleTopic?.id, selectedScheduleFile?.id]);

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!active || !over || active.id === over.id) return;

    const updatedCourse = Course.copy(learningSession.course);
    let fromModuleIdx = -1,
      fromTopicIdx = -1;
    let toModuleIdx = -1,
      toTopicIdx = -1;
    updatedCourse.modules.forEach((mod, mIdx) => {
      mod.topics.forEach((topic, tIdx) => {
        if (topic.id === active.id) {
          fromModuleIdx = mIdx;
          fromTopicIdx = tIdx;
        }
        if (topic.id === over.id) {
          toModuleIdx = mIdx;
          toTopicIdx = tIdx;
        }
      });
    });
    if (fromModuleIdx === -1 || fromTopicIdx === -1 || toModuleIdx === -1 || toTopicIdx === -1) return;

    const [moved] = updatedCourse.modules[fromModuleIdx].topics.splice(fromTopicIdx, 1);
    updatedCourse.modules[toModuleIdx].topics.splice(toTopicIdx, 0, moved);
    updatedCourse.allTopics = updatedCourse.modules.flatMap((m) => m.topics);
    await courseOps.updateCourseStructure(updatedCourse, null, `move topic '${moved.title}' to module '${updatedCourse.modules[toModuleIdx].title}'`);
  };

  if (!learningSession?.course) {
    return <div className="p-4 text-gray-500"></div>;
  }

  const modules = learningSession?.course?.modules;
  const allTopicIds = modules ? modules.flatMap((m) => m.topics.map((t) => t.id)) : [];
  const hasStubbedTopics = learningSession.course.allTopics.some((topic) => topic.state === 'stub' && topic.description);

  function filterTopicsByState() {
    return learningSession.course.modules
      .map((module) => ({
        ...module,
        topics: module.topics.filter((topic) => !topic.state || topic.state === 'published'),
      }))
      .filter((module) => module.topics.length > 0);
  }

  async function generateAllTopics() {
    const stubbedTopics = learningSession.course.allTopics.filter((topic) => topic.state === 'stub' && topic.description);
    if (stubbedTopics.length > 0) {
      let cancelled = false;
      showProgress({
        title: 'Generating stubbed topics',
        currentItem: '',
        current: 0,
        total: stubbedTopics.length,
        onCancel: () => {
          cancelled = true;
        },
      });

      try {
        await courseOps.generateTopics(
          stubbedTopics,
          async (topic, index) => {
            const progress = { currentItem: topic.title, current: index };
            updateProgress(progress);
            if (index > 0) {
              await new Promise((resolve) => setTimeout(resolve, 30000));
              updateProgress({ ...progress, currentItem: 'Giving the gerbils a rest...' });
            }
          },
          () => cancelled,
        );
      } finally {
        hideProgress();
      }
    }
  }

  async function createSchedule() {
    if (!learningSession?.course) return;

    try {
      await courseOps.createSchedule('Schedule');
      navigate(`/course/${learningSession.course.id}/schedule`);
    } catch (error) {
      alert(error.message || 'Unable to create schedule.');
    }
  }

  async function deleteSchedule() {
    if (!learningSession?.course) return;
    if (!window.confirm('Delete the course schedule and all schedule files?')) {
      return;
    }

    try {
      await courseOps.deleteCourseSchedule();
    } catch (error) {
      alert(error.message || 'Unable to delete schedule.');
    }
  }

  const moduleMap = editorVisible ? learningSession.course.modules : filterTopicsByState();
  const moduleJsx = (
    <ul className="list-none p-0">
      {moduleMap.map((module, moduleIndex) => (
        <ModuleSection key={moduleIndex} courseOps={courseOps} learningSession={learningSession} module={module} moduleIndex={moduleIndex} isOpen={openModuleIndexes.includes(moduleIndex)} onToggle={toggleModule} currentTopic={learningSession.topic} editorVisible={editorVisible} dueDatesByTopicId={dueDatesByTopicId} />
      ))}
    </ul>
  );

  return (
    <div id="content" className="h-full overflow-auto p-4 text-sm">
      <nav>
        {scheduleTopic && (
          <div className="mb-2">
            <a href={`/course/${learningSession.course.id}/schedule`} onClick={(e) => {
              e.preventDefault();
              navigate(`/course/${learningSession.course.id}/schedule`);
            }} className={`mr-1 no-underline cursor-pointer truncate max-w-full whitespace-nowrap overflow-hidden text-ellipsis flex items-center gap-2 ${learningSession.topic?.type === 'schedule' ? 'text-amber-500' : 'text-gray-500 hover:text-amber-500'}`}>
              <CalendarDays size={14} />
              Schedule
            </a>
          </div>
        )}
        {editorVisible ? (
          <>
            <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={allTopicIds} strategy={verticalListSortingStrategy}>
                {moduleJsx}
              </SortableContext>
            </DndContext>
            <NewModuleButton courseOps={courseOps} />
            {!scheduleTopic && (
              <div onClick={createSchedule} className="text-gray-400 hover:text-amber-600 text-sm py-1 cursor-pointer">
                + Create schedule
              </div>
            )}
            {scheduleTopic && (
              <div onClick={deleteSchedule} className="text-gray-400 hover:text-red-600 text-sm py-1 cursor-pointer">
                - Delete schedule
              </div>
            )}
            {hasStubbedTopics && (
              <div onClick={generateAllTopics} className="text-gray-400 hover:text-amber-600 text-sm py-1 cursor-pointer">
                + Generate all stubbed topics
              </div>
            )}
          </>
        ) : (
          moduleJsx
        )}
      </nav>
    </div>
  );
}

export default Contents;
