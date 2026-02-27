import React from 'react';
import { EyeOff, Pencil, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function CourseCard({ user, catalogEntry, enrollment, select, remove }) {
  const navigate = useNavigate();

  const colorGenerator = (title) => {
    const colors = ['bg-cyan-700', 'bg-rose-700', 'bg-amber-600', 'bg-indigo-700', 'bg-emerald-700', 'bg-sky-700', 'bg-teal-700'];
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
    <div className="relative grid grid-cols-1 grid-rows-1">
      <ElementType key={catalogEntry.id} {...elementProps} className={`group col-start-1 row-start-1 flex min-h-[200px] cursor-pointer flex-col rounded-2xl border ${enrollment ? 'border-amber-200' : 'border-slate-200'} bg-white p-6 text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-amber-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2`}>
        <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-xl ${enrollment ? enrollment.settings?.cardColor || colorGenerator(catalogEntry.title) : 'bg-slate-300'}`}>
          <span className="text-2xl font-bold text-white">{catalogEntry.title[0]}</span>
        </div>

        <h3 className="mb-2 line-clamp-2 text-lg font-semibold text-slate-900">{catalogEntry.title}</h3>
        <p className="mb-4 line-clamp-3 text-sm text-slate-600">{catalogEntry.description}</p>

        {enrollment ? (
          <div className="mt-auto w-full">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-slate-700">Progress</span>
              <span className="text-slate-500">{enrollment.progress.mastery}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded bg-slate-100">
              <div className="h-full rounded bg-amber-500 transition-all duration-300" style={{ width: `${enrollment.progress.mastery}%` }} />
            </div>
          </div>
        ) : (
          <div className="mt-auto inline-flex w-fit items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">Join course</div>
        )}
      </ElementType>

      <div className="pointer-events-none col-start-1 row-start-1 flex translate-x-3 -translate-y-3 justify-self-end gap-1 self-start">
        {catalogEntry.settings?.state === 'unpublished' && (
          <div className="pointer-events-auto inline-flex h-7 w-7 cursor-default items-center justify-center rounded-full border border-amber-200 bg-white text-slate-600 shadow-sm">
            <span title="Unpublished">
              <EyeOff size={16} />
            </span>
          </div>
        )}
        {user.isEditor(catalogEntry.id) && (
          <div className="pointer-events-auto inline-flex h-7 w-7 cursor-default items-center justify-center rounded-full border border-amber-200 bg-white text-slate-600 shadow-sm">
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
            className="pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-full border border-amber-200 bg-white text-slate-600 shadow-sm transition hover:border-rose-200 hover:bg-rose-500 hover:text-white focus:outline-none"
            title="Remove enrollment"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
