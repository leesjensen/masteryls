import React, { useEffect, useMemo, useState } from 'react';
import { FolderTree, Settings as SettingsIcon, Search } from 'lucide-react';
import Contents from '../../contents.jsx';
import Settings from '../../settings.jsx';
import SearchCourse from '../../components/SearchCourse.jsx';
import Tabs from '../../components/Tabs.jsx';

function Sidebar({ courseOps, user, learningSession, editorVisible }) {
  const tabs = [
    { id: 'topics', label: 'Topics', icon: FolderTree, visible: true },
    { id: 'search', label: 'Search', icon: Search, visible: true },
    { id: 'settings', label: 'Settings', icon: SettingsIcon, visible: user && (user.isEditor(learningSession.course.id) || user.isRoot()) },
  ];
  const visibleTabs = useMemo(() => tabs.filter((tab) => tab.visible), [tabs]);
  const [display, setDisplay] = useState(() => {
    const selected = courseOps.getEnrollmentUiSettings(learningSession.course.id)?.selectedSidebarTab;
    return visibleTabs.some((tab) => tab.id === selected) ? selected : 'topics';
  });

  useEffect(() => {
    const selected = courseOps.getEnrollmentUiSettings(learningSession.course.id)?.selectedSidebarTab;
    const nextDisplay = visibleTabs.some((tab) => tab.id === selected) ? selected : visibleTabs[0]?.id || 'topics';
    setDisplay(nextDisplay);
  }, [courseOps, learningSession.course.id, user, editorVisible]);

  function handleTabChange(nextTab) {
    setDisplay(nextTab);
    courseOps.saveEnrollmentUiSettings(learningSession.course.id, { selectedSidebarTab: nextTab });
  }

  return (
    <div className="flex flex-col bg-white overflow-hidden w-full">
      <div className=" bg-gray-50 ">
        <Tabs tabs={tabs} activeTab={display} onChange={handleTabChange} />
      </div>
      <aside className="flex-1 overflow-auto">
        {display === 'topics' && <Contents courseOps={courseOps} learningSession={learningSession} editorVisible={editorVisible} />}
        {display === 'settings' && <Settings courseOps={courseOps} user={user} course={learningSession.course} />}
        {display === 'search' && <SearchCourse courseOps={courseOps} learningSession={learningSession} />}
      </aside>
    </div>
  );
}

export default Sidebar;
