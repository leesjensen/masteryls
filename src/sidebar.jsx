import React, { useState } from 'react';
import Contents from './contents.jsx';

function Sidebar({ modules, setTopic }) {
  const [sidebarVisible, setSidebarVisible] = useState(true);
  return (
    <>
      {!sidebarVisible && (
        <button className="ml-2 px-2 py-1 text-xs border rounded hover:bg-gray-100" onClick={() => setSidebarVisible(true)}>
          ▶
        </button>
      )}

      {sidebarVisible && (
        <div className="border  p-2 rounded-xs m-2 border-gray-200 bg-gray-50 overflow-hidden">
          <div className="h-[32px] border-gray-200 pb-2 border-b-1 flex items-center justify-between text-sm">
            <button className="px-2 py-1 text-xs hover:bg-gray-100" onClick={() => setSidebarVisible((v) => !v)}>
              ◀
            </button>
            <span className="rounded-b p-1 border">Topics</span>
            <span className="rounded p-1 bg-gray-200 ">Schedule</span>
          </div>
          <aside className="w-[200px] h-full  overflow-hidden">
            <Contents modules={modules} setTopic={setTopic} />
          </aside>
        </div>
      )}
    </>
  );
}

export default Sidebar;
