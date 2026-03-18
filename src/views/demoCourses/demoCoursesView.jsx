import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateAppBar } from '../../hooks/useAppBarState';

function DemoCoursesView({ courseOps }) {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState([]);

  useEffect(() => {
    updateAppBar({ title: 'Demo Courses', tools: null });
  }, []);

  useEffect(() => {
    const c = courseOps.courseCatalog() || [];
    setCatalog(c);
  }, [courseOps]);

  return (
    <section id="catalog-section" className="py-16 bg-amber-50 min-h-full">
      <div className="max-w-7xl mx-auto px-8">
        <h2 className="text-4xl font-bold text-center text-gray-900 mb-8">Try a course</h2>

        <div className="max-w-xl mx-auto">
          <label className="block text-xl font-medium text-gray-800 mb-4">
            Browse a course without creating an account.{' '}
            <a onClick={() => navigate('/')} className="text-amber-600 hover:text-amber-800 cursor-pointer">
              Register
            </a>{' '}
            to use <b>AI learning</b>, track <b>progress</b>, and earn <b>credentials</b>.
          </label>

          <div role="listbox" aria-label="Courses" tabIndex={0} className="w-full rounded-md border border-gray-300 shadow-sm bg-white overflow-y-auto max-h-[500px]">
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
  return (
    <div
      role="option"
      onClick={() => {
        navigate(`/course/${entry.id}`);
      }}
      className={'cursor-pointer px-4 py-3 border-b last:border-b-0 transition-colors duration-150 hover:bg-amber-200'}
    >
      <div className="flex items-center justify-between">
        <div className="font-semibold text-amber-600">{entry.title}</div>
        <div className="text-sm text-gray-500">{entry.duration || ''}</div>
      </div>
      {entry.description && <div className="text-sm text-gray-600 mt-1">{entry.description}</div>}
    </div>
  );
}

export default DemoCoursesView;
