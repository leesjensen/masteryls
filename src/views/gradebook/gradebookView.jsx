import React from 'react';
import { updateAppBar } from '../../hooks/useAppBarState';

function canAccessCourse(user, courseId) {
  if (!user || !courseId) {
    return false;
  }
  return user.isRoot() || user.isEditor(courseId);
}

export default function GradebookView({ courseOps }) {
  const [selectedCourseId, setSelectedCourseId] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [overview, setOverview] = React.useState({ rows: [], totalCount: 0, page: 1, limit: 50, hasMore: false });

  const user = courseOps?.user;

  const availableCourses = React.useMemo(() => {
    const catalog = courseOps?.service?.courseCatalog?.() || [];
    if (!user) {
      return [];
    }
    if (user.isRoot()) {
      return catalog;
    }
    return catalog.filter((entry) => user.isEditor(entry.id));
  }, [courseOps, user]);

  React.useEffect(() => {
    updateAppBar({ title: 'Gradebook', tools: null });
  }, []);

  React.useEffect(() => {
    if (!selectedCourseId && availableCourses.length > 0) {
      setSelectedCourseId(availableCourses[0].id);
      setPage(1);
    }
  }, [availableCourses, selectedCourseId]);

  React.useEffect(() => {
    let cancelled = false;

    async function loadOverview() {
      if (!selectedCourseId || !canAccessCourse(user, selectedCourseId)) {
        setOverview({ rows: [], totalCount: 0, page: 1, limit: 50, hasMore: false });
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const result = await courseOps.getGradebookOverview({ courseId: selectedCourseId, page, limit: 50, search });
        if (!cancelled) {
          setOverview({
            rows: Array.isArray(result?.rows) ? result.rows : [],
            totalCount: Number(result?.totalCount || 0),
            page: Number(result?.page || page),
            limit: Number(result?.limit || 50),
            hasMore: Boolean(result?.hasMore),
          });
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message || String(loadError));
          setOverview({ rows: [], totalCount: 0, page: 1, limit: 50, hasMore: false });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadOverview();

    return () => {
      cancelled = true;
    };
  }, [courseOps, selectedCourseId, search, page, user]);

  function onSearchChange(value) {
    setSearch(value);
    setPage(1);
  }

  function onCourseChange(value) {
    setSelectedCourseId(value);
    setPage(1);
  }

  if (!user) {
    return (
      <div className="flex-1 m-6 flex flex-col bg-white border border-gray-200 rounded-md p-6">
        <p className="text-gray-700">Please log in to view the Gradebook.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 m-6 flex flex-col bg-white border border-gray-200 rounded-md p-6 gap-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-800">Course Gradebook</h2>
        <p className="text-sm text-gray-500 mt-1">Concise learner progress and activity overview.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label htmlFor="gradebook-course" className="block text-sm font-medium text-gray-700 mb-1">
            Course
          </label>
          <select id="gradebook-course" value={selectedCourseId} onChange={(e) => onCourseChange(e.target.value)} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-300">
            {availableCourses.length === 0 && <option value="">No accessible courses</option>}
            {availableCourses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="gradebook-search" className="block text-sm font-medium text-gray-700 mb-1">
            Search learner
          </label>
          <input id="gradebook-search" value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Name or email" className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
        </div>

        <div className="flex items-end text-sm text-gray-600">
          <span>Total learners: {overview.totalCount}</span>
        </div>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="overflow-auto border border-gray-200 rounded-md">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="text-left px-3 py-2 font-semibold">Learner</th>
              <th className="text-left px-3 py-2 font-semibold">Email</th>
              <th className="text-left px-3 py-2 font-semibold">Mastery</th>
              <th className="text-left px-3 py-2 font-semibold">Completed Topics</th>
              <th className="text-left px-3 py-2 font-semibold">Exams Completed</th>
              <th className="text-left px-3 py-2 font-semibold">Project Submits</th>
              <th className="text-left px-3 py-2 font-semibold">Last Activity</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-gray-500">
                  Loading Gradebook...
                </td>
              </tr>
            )}
            {!loading && overview.rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-gray-500">
                  No learners found for this filter.
                </td>
              </tr>
            )}
            {!loading &&
              overview.rows.map((row) => (
                <tr key={row.enrollmentId} className="border-t border-gray-100">
                  <td className="px-3 py-2">{row.learnerName || 'Unknown learner'}</td>
                  <td className="px-3 py-2">{row.learnerEmail || '-'}</td>
                  <td className="px-3 py-2">{Number.isFinite(Number(row.masteryPercent)) ? `${Math.round(Number(row.masteryPercent))}%` : '0%'}</td>
                  <td className="px-3 py-2">{Number(row.completedTopics || 0)}</td>
                  <td className="px-3 py-2">{Number(row.examCompletedCount || 0)}</td>
                  <td className="px-3 py-2">{Number(row.projectSubmittedCount || 0)}</td>
                  <td className="px-3 py-2">{row.lastActivityAt ? new Date(row.lastActivityAt).toLocaleString() : '-'}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1 || loading} className="px-3 py-1 rounded-md border border-gray-300 text-sm disabled:opacity-50">
          Previous
        </button>
        <span className="text-sm text-gray-600">Page {overview.page || page}</span>
        <button type="button" onClick={() => setPage((prev) => prev + 1)} disabled={!overview.hasMore || loading} className="px-3 py-1 rounded-md border border-gray-300 text-sm disabled:opacity-50">
          Next
        </button>
      </div>
    </div>
  );
}
