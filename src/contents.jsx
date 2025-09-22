import React from 'react';
import useHotkeys from './hooks/useHotKeys';
import useModuleState from './hooks/useModuleState';
import ModuleSection from './components/ModuleSection';
import NewModuleButton from './components/NewModuleButton';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
function Contents({ courseOps, service, changeTopic, currentTopic, course, enrollment, editorVisible, navigateToAdjacentTopic, user, setCourse }) {
  const { openModuleIndexes, toggleModule } = useModuleState(course, enrollment, service, currentTopic);

  useHotkeys(
    {
      'ALT+ArrowRight': (e) => {
        navigateToAdjacentTopic('next');
      },
      'ALT+ArrowLeft': (e) => {
        navigateToAdjacentTopic('prev');
      },
    },
    { target: undefined }
  );

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!active || !over || active.id === over.id) return;

    const updatedCourse = Course.copy(course);
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
    setCourse(updatedCourse);
    await courseOps.updateCourseStructure(token, service, `move topic '${moved.title}' to module '${updatedCourse.modules[toModuleIdx].title}'`);
  };

  if (!course) {
    return <div className="p-4 text-gray-500"></div>;
  }

  const allTopicIds = course && course.modules ? course.modules.flatMap((m) => m.topics.map((t) => t.id)) : [];

  return (
    <div id="content" className="h-full overflow-auto p-4 text-sm">
      <nav>
        {editorVisible ? (
          <>
            <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={allTopicIds} strategy={verticalListSortingStrategy}>
                <ul className="list-none p-0">
                  {course.map((module, moduleIndex) => (
                    <ModuleSection key={moduleIndex} module={module} moduleIndex={moduleIndex} isOpen={openModuleIndexes.includes(moduleIndex)} onToggle={toggleModule} currentTopic={currentTopic} changeTopic={changeTopic} editorVisible={editorVisible} courseOps={courseOps} />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
            <NewModuleButton courseOps={courseOps} />
          </>
        ) : (
          <ul className="list-none p-0">
            {course.map((module, moduleIndex) => (
              <ModuleSection key={moduleIndex} module={module} moduleIndex={moduleIndex} isOpen={openModuleIndexes.includes(moduleIndex)} onToggle={toggleModule} currentTopic={currentTopic} changeTopic={changeTopic} editorVisible={editorVisible} courseOps={courseOps} />
            ))}
          </ul>
        )}
      </nav>
    </div>
  );
}

export default Contents;
