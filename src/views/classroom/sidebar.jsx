import React, { useState } from 'react';
import { FolderTree, Settings as SettingsIcon, Search } from 'lucide-react';
import Contents from '../../contents.jsx';
import Settings from '../../settings.jsx';
import SearchCourse from '../../components/SearchCourse.jsx';
import Tabs from '../../components/Tabs.jsx';

function Sidebar({ courseOps, user, learningSession, editorVisible }) {
  const [display, setDisplay] = useState('topics'); // 'topics' 'settings' 'search'

  const tabs = [
    { id: 'topics', label: 'Topics', icon: FolderTree, visible: true },
    { id: 'search', label: 'Search', icon: Search, visible: true },
    { id: 'settings', label: 'Settings', icon: SettingsIcon, visible: user && (user.isEditor(learningSession.course.id) || user.isRoot()) },
  ];
  return (
    <div className="flex flex-col border p-0 rounded-xs m-2 border-gray-200 bg-gray-50 overflow-hidden w-full">
      <Tabs tabs={tabs} activeTab={display} onChange={setDisplay} />
      <aside className="flex-1 overflow-auto">
        {display === 'topics' && <Contents courseOps={courseOps} learningSession={learningSession} editorVisible={editorVisible} />}
        {display === 'settings' && <Settings courseOps={courseOps} user={user} course={learningSession.course} />}
        {display === 'search' && <SearchCourse courseOps={courseOps} learningSession={learningSession} />}
      </aside>
    </div>
  );
}

export default Sidebar;
