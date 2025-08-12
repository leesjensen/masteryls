import React, { useState } from 'react';
import Contents from './contents.jsx';

function Sidebar({ modules, currentTopic, setTopic }) {
  const [display, setDisplay] = useState('topics');

  function toggleDisplay(newDisplay) {
    setDisplay(newDisplay);
  }
  return (
    <div className="border p-2 rounded-xs m-2 border-gray-200 bg-gray-50 overflow-hidden w-full sm:w-[300px]">
      <div className="border-gray-200 pb-2 border-b-1 flex items-center justify-around text-sm">
        <span className={`rounded p-1 ${display === 'topics' ? 'border' : 'bg-gray-200'}`} onClick={() => toggleDisplay('topics')}>
          Topics
        </span>
        <span className={`rounded p-1 ${display === 'schedule' ? 'border' : 'bg-gray-200'}`} onClick={() => toggleDisplay('schedule')}>
          Schedule
        </span>
        <span className={`rounded p-1 ${display === 'settings' ? 'border' : 'bg-gray-200'}`} onClick={() => toggleDisplay('settings')}>
          Settings
        </span>
      </div>
      <aside className="w-full h-full overflow-hidden">
        {display === 'topics' && <Contents modules={modules} currentTopic={currentTopic} setTopic={setTopic} />}
        {display === 'schedule' && <div>Schedule</div>}
        {display === 'settings' && <div>Settings</div>}
      </aside>
    </div>
  );
}

export default Sidebar;
