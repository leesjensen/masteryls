import React, { useState } from 'react';
import { Pencil, X, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function CourseCard({ user, catalogEntry, enrollment, select, remove }) {
  const navigate = useNavigate();

  const colorGenerator = (title) => {
    const colors = ['bg-cyan-700', 'bg-red-700', 'bg-yellow-600', 'bg-purple-700', 'bg-amber-500', 'bg-red-700', 'bg-indigo-700', 'bg-teal-700', 'bg-green-700'];
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
      hash = title.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const href = enrollment ? `/course/${enrollment.catalogId}` : null;

  const handleClick = (e) => {
    if (href && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
      e.preventDefault();
      navigate(href);
    } else if (!href) {
      select(catalogEntry);
    }
  };

  const ElementType = href ? 'a' : 'button';
  const elementProps = href ? { href, onClick: handleClick } : { type: 'button', onClick: handleClick };

  return (
    <div className="grid grid-cols-1 grid-rows-1 relative">
      <ElementType key={catalogEntry.id} {...elementProps} className="col-start-1 row-start-1 flex flex-col items-center p-6 rounded-xl bg-gray-50 shadow-md min-h-[280px] transition-transform duration-200 focus:outline-none hover:scale-102 hover:shadow-lg cursor-pointer">
        <div className={`h-32 w-32 rounded-lg mb-4 flex items-center justify-center ${enrollment ? colorGenerator(catalogEntry.title) : 'bg-gray-300'}`}>
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
      </ElementType>

      <div className="col-start-1 row-start-1 justify-self-end self-start flex flex-row gap-1 z-10 translate-x-3 -translate-y-3">
        {catalogEntry.settings?.state === 'unpublished' && (
          <div className="inline-flex items-center justify-center w-7 h-7 rounded-full border-gray-200 border-1 bg-white text-gray-600 text-xs shadow cursor-default">
            <span title="Unpublished">
              <EyeOff size={16} />
            </span>
          </div>
        )}
        {user.isEditor(catalogEntry.id) && (
          <div className="inline-flex items-center justify-center w-7 h-7 rounded-full border-gray-200 border-1 bg-white text-gray-600 text-xs shadow cursor-default">
            <span title="Editor rights">
              <Pencil size={16} />
            </span>
          </div>
        )}

        {enrollment && remove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              remove(enrollment);
            }}
            aria-label="Delete"
            className="inline-flex items-center justify-center w-7 h-7 rounded-full border-gray-200 border-1 bg-white text-gray-600 text-xs shadow hover:text-gray-50 hover:bg-red-500 focus:outline-none"
            title="Remove enrollment"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
