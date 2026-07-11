import React from 'react';

export default function TabBar({ tabs, active, onChange }) {
  return (
    <div className="not-prose mt-4 overflow-x-auto">
      <div className="flex min-w-max border-b border-gray-200">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => onChange(tab.id)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${active === tab.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
