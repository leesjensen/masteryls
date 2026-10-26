import React from 'react';

// Canonical tab bar for the app. Two layouts:
//   variant="fill"   - equal-width tabs that fill the container (sidebar, discussion panel)
//   variant="scroll" - content-width tabs that scroll horizontally when they overflow
//                      (assessment workspaces)
// Each tab is { id, label, icon?, visible? }. A tab is shown unless `visible` is
// explicitly falsy (false/null); a missing `visible` is treated as visible.
function Tabs({ tabs, active, onChange, variant = 'fill' }) {
  const scroll = variant === 'scroll';
  return (
    <div className={scroll ? 'not-prose mt-4 overflow-x-auto' : ''}>
      <div className={`flex border-b border-gray-200 ${scroll ? 'min-w-max' : 'items-center text-sm'}`}>
        {tabs.map((tab) => {
          const isVisible = tab.visible === undefined || !!tab.visible;
          if (!isVisible) return null;
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`font-medium border-b-2 transition-colors ${scroll ? 'px-4 py-2 text-sm -mb-px whitespace-nowrap' : 'flex-1 py-3 px-2 flex items-center justify-center gap-2'} ${isActive ? 'border-blue-500 text-blue-600' : `border-transparent ${scroll ? 'text-gray-500 hover:text-gray-700 hover:border-gray-300' : 'text-gray-600 hover:text-gray-900'}`}`}
            >
              {tab.icon && <tab.icon size={18} />}
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default Tabs;
