import React, { useState } from 'react';
import Contents from './contents.jsx';
import Settings from './settings.jsx';

function Sidebar({ courseOps, service, user, course, setCourse, currentTopic, editorVisible }) {
  const [display, setDisplay] = useState('topics');

  function toggleDisplay(newDisplay) {
    setDisplay(newDisplay);
  }
  return (
    <div className="flex flex-col border p-2 rounded-xs m-2 border-gray-200 bg-gray-50 overflow-hidden w-full">
      {(user.isEditor(course.id) || user.isRoot()) && (
        <div className="basis-[30px] border-gray-200 pb-2 border-b-1 flex items-center justify-around text-sm">
          <span className={`rounded p-1 ${display === 'topics' ? 'border' : 'bg-gray-200'}`} onClick={() => toggleDisplay('topics')}>
            Topics
          </span>
          <span className={`rounded p-1 ${display === 'settings' ? 'border' : 'bg-gray-200'}`} onClick={() => toggleDisplay('settings')}>
            Settings
          </span>
        </div>
      )}
      <aside className="flex-1 overflow-auto">
        {display === 'topics' && <Contents courseOps={courseOps} service={service} course={course} currentTopic={currentTopic} editorVisible={editorVisible} user={user} setCourse={setCourse} />}
        <button onClick={() => courseOps.generateRandomData()} className="m-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm transition-colors">
          Generate data
        </button>

        {display === 'settings' && <Settings service={service} user={user} course={course} setCourse={setCourse} />}
      </aside>
    </div>
  );
}

export default Sidebar;
