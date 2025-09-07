import React, { useState } from 'react';

export default function CourseCard({ user, catalogEntry, enrollment, select, remove }) {
  return (
    <div className="grid">
      <button key={catalogEntry.id} type="button" onClick={() => select(catalogEntry)} className="col-start-1 row-start-1 flex flex-col items-center p-6 rounded-xl bg-gray-50 shadow-md min-h-[280px] transition-transform duration-200 focus:outline-none hover:scale-102 hover:shadow-lg cursor-pointer">
        <div className={`h-32 w-32 rounded-lg mb-4 flex items-center justify-center ${enrollment ? 'bg-amber-500' : 'bg-gray-300'}`}>
          <span className="text-white text-6xl font-bold">{catalogEntry.title[0]}</span>
        </div>

        <div className="text-lg font-semibold mb-2 text-center">{catalogEntry.title}</div>
        <div className="text-gray-500 text-sm mb-3 text-center overflow-hidden text-ellipsis whitespace-normal line-clamp-3">{catalogEntry.description}</div>

        {enrollment && (
          <div className="w-full mt-auto">
            <div className="text-xs text-gray-700 mb-1">Progress</div>
            <div className="bg-blue-100 rounded h-2 w-full mb-1 overflow-hidden">
              <div className="bg-blue-500 h-full" style={{ width: `${enrollment.progress.mastery}%` }} />
            </div>
            <div className="text-xs text-gray-400">{enrollment.progress.mastery}% complete</div>
          </div>
        )}
      </button>

      {enrollment && remove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            remove(enrollment);
          }}
          aria-label="Delete"
          className="col-start-1 row-start-1 justify-self-end -translate-y-3 translate-x-3 
             inline-flex items-center justify-center w-7 h-7 rounded-full bg-white text-gray-600 text-xs shadow 
             hover:text-gray-50 hover:bg-red-500 focus:outline-none"
          title="Remove enrollment"
        >
          ✕
        </button>
      )}

      {enrollment && (enrollment.settings?.token || enrollment.catalogEntry?.ownerId === user.id) && (
        <div
          className="col-start-1 row-start-1 justify-self-end -translate-y-3 -translate-x-6 
             inline-flex items-center justify-center w-7 h-7 rounded-full bg-white text-gray-600 text-xs shadow cursor-default
            "
        >
          <span title="editor rights" className="text-lg text-yellow-400">
            {enrollment.catalogEntry?.ownerId === user.id ? '★' : '✏️'}
          </span>
        </div>
      )}
    </div>
  );
}
