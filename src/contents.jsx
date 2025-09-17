import React from 'react';
import useHotkeys from './hooks/useHotKeys';
import useModuleState from './hooks/useModuleState';
import useTopicOperations from './hooks/useTopicOperations';
import ModuleSection from './components/ModuleSection';

function Contents({ service, changeTopic, currentTopic, course, enrollment, editorVisible, navigateToAdjacentTopic, user, setCourse }) {
  // Handler for topic reordering within a module
  const handleTopicReorder = async (moduleIndex, oldIndex, newIndex) => {
    const updatedCourse = course.constructor._copy(course);
    const topics = updatedCourse.modules[moduleIndex].topics;
    if (oldIndex !== newIndex) {
      const moved = topics.splice(oldIndex, 1)[0];
      topics.splice(newIndex, 0, moved);
      updatedCourse.allTopics = updatedCourse.modules.flatMap((m) => m.topics);
      setCourse(updatedCourse);
      // Persist the change to backend
      try {
        const token = user.gitHubToken(course.id);
        if (token) {
          await updatedCourse.commitCourseStructure(user, service, `reorder topics in module ${updatedCourse.modules[moduleIndex].title}`);
        }
      } catch (err) {
        console.error('Failed to persist topic order:', err);
      }
    }
  };
  const { openModuleIndexes, toggleModule } = useModuleState(course, enrollment, service, currentTopic);

  const { showTopicForm, setShowTopicForm, newTopicTitle, setNewTopicTitle, newTopicType, setNewTopicType, addTopic, removeTopic, cancelTopicForm } = useTopicOperations(course, setCourse, user, service, currentTopic, changeTopic);

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

  return (
    <div id="content" className="h-full overflow-auto p-4 text-sm">
      <nav>
        <ul className="list-none p-0">
          {course.map((module, moduleIndex) => (
            <ModuleSection key={moduleIndex} module={module} moduleIndex={moduleIndex} isOpen={openModuleIndexes.includes(moduleIndex)} onToggle={toggleModule} currentTopic={currentTopic} changeTopic={changeTopic} editorVisible={editorVisible} showTopicForm={showTopicForm} setShowTopicForm={setShowTopicForm} newTopicTitle={newTopicTitle} setNewTopicTitle={setNewTopicTitle} newTopicType={newTopicType} setNewTopicType={setNewTopicType} onAddTopic={addTopic} onRemoveTopic={removeTopic} cancelTopicForm={cancelTopicForm} onTopicReorder={handleTopicReorder} />
          ))}
        </ul>
      </nav>
    </div>
  );
}

export default Contents;
