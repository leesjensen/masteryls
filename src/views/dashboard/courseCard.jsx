import React from 'react';
import { EyeOff, Pencil, X, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { pulseSummaryText } from '../../utils/pulseMarkdown.js';

function formatPulseDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function CourseCard({ user, catalogEntry, enrollment, masteryPercent = null, pulse = null, select, remove }) {
  const navigate = useNavigate();
  const displayMastery = Number.isFinite(Number(masteryPercent)) ? Math.max(0, Math.min(100, Math.round(Number(masteryPercent)))) : Number.isFinite(Number(enrollment?.progress?.mastery)) ? Math.max(0, Math.min(100, Math.round(Number(enrollment.progress.mastery)))) : 0;

  const colorGenerator = (title) => {
    const colors = ['bg-cyan-700', 'bg-rose-700', 'bg-amber-600', 'bg-indigo-700', 'bg-emerald-700', 'bg-sky-700', 'bg-teal-700'];
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
      hash = title.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const courseHref = enrollment ? `/course/${enrollment.catalogId}` : null;
  const pulseHref = enrollment ? `/course/${enrollment.catalogId}/mastery?tab=pulses` : null;
  const pulseSummary = pulse ? pulseSummaryText(pulse.markdown) : '';

  // In-app navigation that still lets a modifier-click open the real <a href> in a new tab.
  const navTo = (href) => (e) => {
    if (href && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
      e.preventDefault();
      navigate(href);
    }
  };

  const shell = 'group col-start-1 row-start-1 flex min-h-[300px] cursor-pointer flex-col rounded-2xl border border-gray-200 p-6 text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-2 hover:border-gray-400 hover:shadow-md';

  const iconBlock = (
    <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-xl ${enrollment ? enrollment.settings?.cardColor || colorGenerator(catalogEntry.title) : 'bg-slate-300'}`}>
      <span className="text-2xl font-bold text-white">{catalogEntry.title[0]}</span>
    </div>
  );

  const overlay = (
    <div className="pointer-events-none col-start-1 row-start-1 z-20 flex translate-x-3 -translate-y-3 justify-self-end gap-1 self-start">
      {catalogEntry.settings?.state === 'unpublished' && (
        <div className="pointer-events-auto inline-flex h-7 w-7 cursor-default items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm">
          <span title="Unpublished">
            <EyeOff size={16} />
          </span>
        </div>
      )}
      {user.isEditor(catalogEntry.id) && (
        <div className="pointer-events-auto inline-flex h-7 w-7 cursor-default items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm">
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
          className="pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-rose-200 hover:bg-rose-500 hover:text-white focus:outline-none"
          title="Remove enrollment"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );

  // Catalog card (not yet enrolled): the whole card is a button that starts enrollment.
  if (!enrollment) {
    return (
      <div className="relative grid grid-cols-1 grid-rows-1">
        <button type="button" onClick={() => select(catalogEntry)} className={`${shell} relative bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2`}>
          {iconBlock}
          <h3 className="mb-2 line-clamp-2 text-lg font-semibold text-slate-900">{catalogEntry.title}</h3>
          <p className="mb-4 line-clamp-3 text-sm text-slate-600">{catalogEntry.description}</p>
          <div className="mt-auto inline-flex w-fit items-center rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-800">Join course</div>
        </button>
        {overlay}
      </div>
    );
  }

  // Enrolled card: a static shell with a stretched primary link into the course. When a learner pulse
  // exists it replaces the course blurb and carries its own link to the learner's Pulses tab. The
  // stretched link (`after:inset-0`) keeps the whole card clickable to the course; the pulse link and
  // the overlay actions sit above it (`z-10`/`z-20`) so they stay independently clickable.
  return (
    <div className="relative grid grid-cols-1 grid-rows-1">
      <div className={`${shell} relative bg-white`}>
        {iconBlock}
        <h3 className="mb-2 line-clamp-2 text-lg font-semibold text-slate-900">
          <a href={courseHref} onClick={navTo(courseHref)} className="rounded after:absolute after:inset-0 after:content-[''] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
            {catalogEntry.title}
          </a>
        </h3>

        {pulse ? (
          <div className="mb-4">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
              <a href={pulseHref} onClick={navTo(pulseHref)} className="relative z-10 inline-flex items-center gap-1.5 rounded text-blue-700 hover:text-blue-800 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1">
                <Activity size={14} aria-hidden="true" />
                <span>Latest pulse</span>
              </a>
              {pulse.createdAt && <span className="font-normal normal-case text-slate-400">· {formatPulseDate(pulse.createdAt)}</span>}
            </div>
            <p className="line-clamp-4 text-sm text-slate-600">{pulseSummary}</p>
          </div>
        ) : (
          <p className="mb-4 line-clamp-3 text-sm text-slate-600">{catalogEntry.description}</p>
        )}

        <div className="mt-auto w-full">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-medium text-slate-700">Progress</span>
            <span className="text-slate-500">{displayMastery}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded bg-slate-100">
            <div className="h-full rounded bg-blue-500 transition-all duration-300" style={{ width: `${displayMastery}%` }} />
          </div>
        </div>
      </div>
      {overlay}
    </div>
  );
}
