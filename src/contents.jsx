import React from 'react';
import useHotkeys from './hooks/useHotKeys';
import useModuleState from './hooks/useModuleState';
import useTopicOperations from './hooks/useTopicOperations';
import ModuleSection from './components/ModuleSection';

function Contents({ service, changeTopic, currentTopic, course, enrollment, editorVisible, navigateToAdjacentTopic, user, setCourse }) {
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
            <ModuleSection key={moduleIndex} module={module} moduleIndex={moduleIndex} isOpen={openModuleIndexes.includes(moduleIndex)} onToggle={toggleModule} currentTopic={currentTopic} changeTopic={changeTopic} editorVisible={editorVisible} showTopicForm={showTopicForm} setShowTopicForm={setShowTopicForm} newTopicTitle={newTopicTitle} setNewTopicTitle={setNewTopicTitle} newTopicType={newTopicType} setNewTopicType={setNewTopicType} onAddTopic={addTopic} onRemoveTopic={removeTopic} cancelTopicForm={cancelTopicForm} />
          ))}
        </ul>
      </nav>
    </div>
  );
}

export default Contents;
