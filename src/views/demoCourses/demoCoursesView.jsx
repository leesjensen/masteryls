import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateAppBar } from '../../hooks/useAppBarState';
import { handleInAppLinkClick } from '../../utils/linkNavigation.js';

function DemoCoursesView({ courseOps }) {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState([]);

  useEffect(() => {
    updateAppBar({ title: 'Demo Courses', tools: null });
  }, []);

  useEffect(() => {
    // The public, logged-out browse list shows only courses marked public (settings.public) — the same
    // flag that opts a course into search-engine indexing. Non-public courses stay out of the public list.
    const c = (courseOps.courseCatalog() || []).filter((entry) => entry.settings?.public);
    setCatalog(c);
  }, [courseOps]);

  return (
    <section id="catalog-section" className="py-16 bg-blue-50 min-h-full">
      <div className="max-w-7xl mx-auto px-8">
        <h2 className="text-4xl font-bold text-center text-gray-900 mb-8">Browse a course</h2>

        <div className="max-w-xl mx-auto">
          <label className="block text-xl font-medium text-gray-800 mb-4">
            Browse a course without creating an account.{' '}
            <a onClick={() => navigate('/')} className="text-blue-600 hover:text-blue-800 cursor-pointer">
              Register
            </a>{' '}
            to use <b>AI learning</b>, track <b>progress</b>, and earn <b>credentials</b>.
          </label>

          <div aria-label="Courses" className="w-full rounded-md border border-gray-300 shadow-sm bg-white overflow-y-auto max-h-[500px]">
            {catalog.map((entry) => (
              <CourseEntry key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CourseEntry({ entry }) {
  const navigate = useNavigate();
  // A real <a href> (not an onClick div) so crawlers can discover and follow the course URL, and so
  // the browser offers "open in new tab". A plain click still navigates inside the SPA.
  return (
    <a
      href={`/course/${entry.id}`}
      onClick={(e) => handleInAppLinkClick(e, () => navigate(`/course/${entry.id}`))}
      className={'block no-underline text-inherit cursor-pointer px-4 py-3 border-b last:border-b-0 transition-colors duration-150 hover:bg-blue-200'}
    >
      <div className="flex items-center justify-between">
        <div className="font-semibold text-blue-600">{entry.title}</div>
        <div className="text-sm text-gray-500">{entry.duration || ''}</div>
      </div>
      {entry.description && <div className="text-sm text-gray-600 mt-1">{entry.description}</div>}
    </a>
  );
}

export default DemoCoursesView;
