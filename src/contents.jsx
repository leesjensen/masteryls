import React from 'react';
import useHotkeys from './hooks/useHotKeys';
import useModuleState from './hooks/useModuleState';
import ModuleSection from './components/ModuleSection';
import NewModuleButton from './components/NewModuleButton';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import Course from './course.js';
import { useProgress } from './contexts/ProgressContext.jsx';
import { useNavigate } from 'react-router-dom';

function Contents({ courseOps, learningSession, editorVisible }) {
  const { openModuleIndexes, toggleModule } = useModuleState(courseOps, learningSession?.course, learningSession?.topic);
  const { showProgress, updateProgress, hideProgress } = useProgress();
  const navigate = useNavigate();

  useHotkeys(
    {
      'ALT+ArrowRight': (e) => {
        navigateToTopic('next');
      },
      'ALT+ArrowLeft': (e) => {
        navigateToTopic('prev');
      },
    },
    { target: undefined },
  );

  function navigateToTopic(direction) {
    const newTopic = courseOps.getAdjacentTopic(direction);
    if (newTopic) {
      navigate(`/course/${learningSession.course.id}/topic/${newTopic.id}`);
    }
  }

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

  const moduleMap = editorVisible ? learningSession.course.modules : filterTopicsByState();
  const moduleJsx = (
    <ul className="list-none p-0">
      {moduleMap.map((module, moduleIndex) => (
        <ModuleSection key={moduleIndex} courseOps={courseOps} learningSession={learningSession} module={module} moduleIndex={moduleIndex} isOpen={openModuleIndexes.includes(moduleIndex)} onToggle={toggleModule} currentTopic={learningSession.topic} editorVisible={editorVisible} />
      ))}
    </ul>
  );

  return (
    <div id="content" className="h-full overflow-auto p-4 text-sm">
      <nav>
        {editorVisible ? (
          <>
            <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={allTopicIds} strategy={verticalListSortingStrategy}>
                {moduleJsx}
              </SortableContext>
            </DndContext>
            <NewModuleButton courseOps={courseOps} />
            <div onClick={generateAllTopics} className="text-gray-400 hover:text-amber-600 text-sm py-1 cursor-pointer">
              + Generate all stubbed topics
            </div>
          </>
        ) : (
          moduleJsx
        )}
      </nav>
    </div>
  );
}

export default Contents;
