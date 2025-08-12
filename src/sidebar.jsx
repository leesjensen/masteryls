import React, { useState } from 'react';
import Contents from './contents.jsx';

function Sidebar({ modules, setTopic }) {
  return (
    <div className="border  p-2 rounded-xs m-2 border-gray-200 bg-gray-50 overflow-hidden">
      <div className="h-[32px] border-gray-200 pb-2 border-b-1 flex items-center justify-between text-sm">
        <span className="rounded-b p-1 border">Topics</span>
        <span className="rounded p-1 bg-gray-200 ">Schedule</span>
      </div>
      <aside className="w-[200px] h-full  overflow-hidden">
        <Contents modules={modules} setTopic={setTopic} />
      </aside>
    </div>
  );
}

export default Sidebar;
