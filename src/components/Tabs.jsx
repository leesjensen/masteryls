import React from 'react';

function Tabs({ tabs, activeTab, onChange }) {
  return (
    <div className="border-gray-200 border-b flex items-center text-sm">
      {tabs.map((tab) => (
        <button key={tab.id} onClick={() => onChange(tab.id)} className={`flex-1 py-3 px-4 font-medium transition-all ${activeTab === tab.id ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600 hover:text-gray-900 border-b-2 border-transparent'}`}>
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export default Tabs;
