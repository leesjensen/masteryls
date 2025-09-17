import React from 'react';
import useHotkeys from './hooks/useHotKeys';
import useModuleState from './hooks/useModuleState';
import useTopicOperations from './hooks/useTopicOperations';
import ModuleSection from './components/ModuleSection';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
function Contents({ service, changeTopic, currentTopic, course, enrollment, editorVisible, navigateToAdjacentTopic, user, setCourse }) {
  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!active || !over || active.id === over.id) return;

    const updatedCourse = course.constructor._copy(course);
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
    try {
      const token = user.gitHubToken(course.id);
      if (token) {
        await updatedCourse.commitCourseStructure(user, service, `move topic '${moved.title}' to module '${updatedCourse.modules[toModuleIdx].title}'`);
      }
    } catch (err) {
      console.error('Failed to persist topic order:', err);
    }
  };
  const { openModuleIndexes, toggleModule } = useModuleState(course, enrollment, service, currentTopic);

  const { showTopicForm, setShowTopicForm, newTopicTitle, setNewTopicTitle, newTopicType, setNewTopicType, addTopic, renameTopic, removeTopic, cancelTopicForm } = useTopicOperations(course, setCourse, user, service, currentTopic, changeTopic);

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

  if (!course) {
    return <div className="p-4 text-gray-500"></div>;
  }

  const allTopicIds = course && course.modules ? course.modules.flatMap((m) => m.topics.map((t) => t.id)) : [];

  return (
    <div id="content" className="h-full overflow-auto p-4 text-sm">
      <nav>
        {editorVisible ? (
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={allTopicIds} strategy={verticalListSortingStrategy}>
              <ul className="list-none p-0">
                {course.map((module, moduleIndex) => (
                  <ModuleSection key={moduleIndex} module={module} moduleIndex={moduleIndex} isOpen={openModuleIndexes.includes(moduleIndex)} onToggle={toggleModule} currentTopic={currentTopic} changeTopic={changeTopic} editorVisible={editorVisible} showTopicForm={showTopicForm} setShowTopicForm={setShowTopicForm} newTopicTitle={newTopicTitle} setNewTopicTitle={setNewTopicTitle} newTopicType={newTopicType} setNewTopicType={setNewTopicType} onAddTopic={addTopic} onRenameTopic={renameTopic} onRemoveTopic={removeTopic} cancelTopicForm={cancelTopicForm} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        ) : (
          <ul className="list-none p-0">
            {course.map((module, moduleIndex) => (
              <ModuleSection key={moduleIndex} module={module} moduleIndex={moduleIndex} isOpen={openModuleIndexes.includes(moduleIndex)} onToggle={toggleModule} currentTopic={currentTopic} changeTopic={changeTopic} editorVisible={editorVisible} showTopicForm={showTopicForm} setShowTopicForm={setShowTopicForm} newTopicTitle={newTopicTitle} setNewTopicTitle={setNewTopicTitle} newTopicType={newTopicType} setNewTopicType={setNewTopicType} onAddTopic={addTopic} onRemoveTopic={removeTopic} cancelTopicForm={cancelTopicForm} />
            ))}
          </ul>
        )}
      </nav>
    </div>
  );
}

export default Contents;
