import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { updateAppBar } from '../../hooks/useAppBarState';

function formatDuration(seconds) {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return '-';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return sec > 0 ? `${m}m ${sec}s` : `${m}m`;
  return `${sec}s`;
}

export default function MasteryView({ courseOps, startObserveSession = null }) {
  const navigate = useNavigate();
  const { courseId: routeCourseId } = useParams();
  const [selectedCourseId, setSelectedCourseId] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [overview, setOverview] = React.useState({ rows: [], totalCount: 0, page: 1, limit: 50, hasMore: false });
  const [enrolledCourseIds, setEnrolledCourseIds] = React.useState(new Set());
  const [filterText, setFilterText] = React.useState('');
  const [confirmedFilters, setConfirmedFilters] = React.useState([]);
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const [sort, setSort] = React.useState({ key: null, direction: 'asc' });

  const courseOpsRef = React.useRef(courseOps);
  courseOpsRef.current = courseOps;

  const user = courseOps?.user;
  const canViewLearnerFilters = React.useMemo(() => {
    if (!user) {
      return false;
    }
    if (user.isRoot()) {
      return true;
    }
    return selectedCourseId ? user.isEditor(selectedCourseId) : user.isEditor();
  }, [user, selectedCourseId]);

  const availableCourses = React.useMemo(() => {
    const catalog = courseOpsRef.current?.service?.courseCatalog?.() || [];
    if (!user) {
      return [];
    }
    if (user.isRoot()) {
      return catalog;
    }
    return catalog.filter((entry) => user.isEditor(entry.id) || enrolledCourseIds.has(entry.id));
  }, [enrolledCourseIds, user]);

  const hasCourseAccess = React.useMemo(() => {
    if (!user || !selectedCourseId) {
      return false;
    }
    return user.isRoot() || user.isEditor(selectedCourseId) || enrolledCourseIds.has(selectedCourseId);
  }, [enrolledCourseIds, selectedCourseId, user]);
  const canObserveLearners = React.useMemo(() => Boolean(user && selectedCourseId && (user.isRoot() || user.isEditor(selectedCourseId))), [user, selectedCourseId]);

  const confirmedIds = React.useMemo(() => new Set(confirmedFilters.map((f) => f.learnerId)), [confirmedFilters]);

  const suggestions = React.useMemo(() => {
    if (!filterText) return [];
    const lower = filterText.toLowerCase();
    return overview.rows.filter(
      (row) =>
        !confirmedIds.has(row.learnerId) &&
        ((row.learnerName || '').toLowerCase().includes(lower) || (row.learnerEmail || '').toLowerCase().includes(lower)),
    );
  }, [filterText, overview.rows, confirmedIds]);

  const displayedRows = React.useMemo(() => {
    const rows = confirmedFilters.length === 0 ? overview.rows : overview.rows.filter((row) => confirmedIds.has(row.learnerId));

    if (!sort.key) return rows;

    const dir = sort.direction === 'desc' ? -1 : 1;
    return [...rows].sort((a, b) => {
      switch (sort.key) {
        case 'learnerName':
          return String(a.learnerName || '').localeCompare(String(b.learnerName || '')) * dir;
        case 'learnerEmail':
          return String(a.learnerEmail || '').localeCompare(String(b.learnerEmail || '')) * dir;
        case 'masteryPercent':
          return (Number(a.masteryPercent || 0) - Number(b.masteryPercent || 0)) * dir;
        case 'completedTopics':
          return (Number(a.completedTopics || 0) - Number(b.completedTopics || 0)) * dir;
        case 'examCompletedCount':
          return (Number(a.examCompletedCount || 0) - Number(b.examCompletedCount || 0)) * dir;
        case 'projectSubmittedCount':
          return (Number(a.projectSubmittedCount || 0) - Number(b.projectSubmittedCount || 0)) * dir;
        case 'totalTimeSpent': {
          const at = Number(a.totalTimeSpent || a.progress?.totalTimeSpent || 0);
          const bt = Number(b.totalTimeSpent || b.progress?.totalTimeSpent || 0);
          return (at - bt) * dir;
        }
        case 'lastActivityAt': {
          const ad = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
          const bd = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
          return (ad - bd) * dir;
        }
        default:
          return 0;
      }
    });
  }, [confirmedFilters.length, confirmedIds, overview.rows, sort]);

  React.useEffect(() => {
    updateAppBar({ title: 'MasteryView', tools: null });
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    async function loadEnrollments() {
      if (!user || user.isRoot()) {
        setEnrolledCourseIds(new Set());
        return;
      }

      try {
        const enrollmentMap = await courseOpsRef.current.service.enrollments(user.id);
        if (!cancelled) {
          setEnrolledCourseIds(new Set(Array.from(enrollmentMap.keys())));
        }
      } catch {
        if (!cancelled) {
          setEnrolledCourseIds(new Set());
        }
      }
    }

    loadEnrollments();

    return () => {
      cancelled = true;
    };
  }, [user]);

  React.useEffect(() => {
    if (routeCourseId) {
      if (selectedCourseId !== routeCourseId) {
        setSelectedCourseId(routeCourseId);
        setPage(1);
      }
      return;
    }

    if ((!selectedCourseId || !availableCourses.some((course) => course.id === selectedCourseId)) && availableCourses.length > 0) {
      setSelectedCourseId(availableCourses[0].id);
      setPage(1);
    }
  }, [availableCourses, routeCourseId, selectedCourseId]);

  React.useEffect(() => {
    let cancelled = false;

    async function loadOverview() {
      if (!selectedCourseId || !hasCourseAccess) {
        setOverview({ rows: [], totalCount: 0, page: 1, limit: 50, hasMore: false });
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const result = await courseOpsRef.current.getMasteryOverview({ courseId: selectedCourseId, page, limit: 50 });
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
  }, [hasCourseAccess, selectedCourseId, page]);

  function toggleSort(key) {
    setSort((prev) => prev.key === key ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' });
  }

  function sortLabel(key, label) {
    let indicator;
    if (sort.key !== key) {
      indicator = <ArrowUpDown data-testid="sort-none" size={12} className="ml-1 inline opacity-40" aria-label="Not sorted" />;
    } else if (sort.direction === 'asc') {
      indicator = <ArrowUp data-testid="sort-asc" size={12} className="ml-1 inline" aria-label="Sorted ascending" />;
    } else {
      indicator = <ArrowDown data-testid="sort-desc" size={12} className="ml-1 inline" aria-label="Sorted descending" />;
    }
    return (
      <>
        {label}
        {indicator}
      </>
    );
  }

  function onCourseChange(value) {
    if (value) {
      navigate(`/masteryview/course/${value}`);
    } else {
      navigate('/masteryview');
    }
    setPage(1);
    setConfirmedFilters([]);
    setFilterText('');
    setSort({ key: null, direction: 'asc' });
  }

  function onConfirmFilter(row) {
    if (confirmedIds.has(row.learnerId)) return;
    setConfirmedFilters((prev) => [...prev, { learnerId: row.learnerId, learnerName: row.learnerName, learnerEmail: row.learnerEmail }]);
    setFilterText('');
    setShowSuggestions(false);
  }

  function onRemoveFilter(learnerId) {
    setConfirmedFilters((prev) => prev.filter((f) => f.learnerId !== learnerId));
  }

  function onSelectLearner(row) {
    if (!selectedCourseId || !row?.learnerId) return;
    navigate(`/masteryview/learner/${row.learnerId}/course/${selectedCourseId}`);
  }

  function onObserveLearner(row, event) {
    event?.stopPropagation?.();
    if (!canObserveLearners || !selectedCourseId || typeof startObserveSession !== 'function') {
      return;
    }
    startObserveSession({
      courseId: selectedCourseId,
      learnerId: row.learnerId,
      learnerName: row.learnerName,
      learnerEmail: row.learnerEmail,
    });
    navigate(`/course/${selectedCourseId}`);
  }

  if (!user) {
    return (
      <div className="flex-1 m-6 flex flex-col bg-white border border-gray-200 rounded-md p-6">
        <p className="text-gray-700">Please log in to view MasteryView.</p>
      </div>
    );
  }

  const colSpan = canObserveLearners ? 9 : 8;

  return (
    <div className="flex-1 m-6 flex flex-col bg-white border border-gray-200 rounded-md p-6 gap-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-800">Course MasteryView</h2>
      </div>

      <div className={`grid grid-cols-1 ${canViewLearnerFilters ? 'md:grid-cols-3' : 'md:grid-cols-1'} gap-3`}>
        <div>
          <label htmlFor="masteryview-course" className="block text-sm font-medium text-gray-700 mb-1">
            Course
          </label>
          <select id="masteryview-course" value={selectedCourseId} onChange={(e) => onCourseChange(e.target.value)} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-300">
            {availableCourses.length === 0 && <option value="">No accessible courses</option>}
            {availableCourses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </div>

        {canViewLearnerFilters && (
          <div className="relative">
            <label htmlFor="masteryview-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Filter learner
            </label>
            <input
              id="masteryview-filter"
              value={filterText}
              onChange={(e) => {
                setFilterText(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Name or email"
              autoComplete="off"
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
              aria-label="Filter learner"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                {suggestions.map((row) => (
                  <button
                    key={row.learnerId}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-amber-50 flex flex-col"
                    onMouseDown={() => onConfirmFilter(row)}
                  >
                    <span className="font-medium">{row.learnerName || 'Unknown'}</span>
                    <span className="text-gray-500 text-xs">{row.learnerEmail}</span>
                  </button>
                ))}
              </div>
            )}
            {confirmedFilters.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {confirmedFilters.map((f) => (
                  <span key={f.learnerId} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs">
                    {f.learnerName || f.learnerEmail}
                    <button type="button" onClick={() => onRemoveFilter(f.learnerId)} className="hover:text-amber-900 font-bold leading-none" aria-label={`Remove ${f.learnerName || f.learnerEmail} filter`}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {canViewLearnerFilters && (
          <div className="flex items-end text-sm text-gray-600">
            <span>Total learners: {confirmedFilters.length > 0 ? displayedRows.length : overview.totalCount}</span>
          </div>
        )}
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="overflow-auto border border-gray-200 rounded-md">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              {[
                ['learnerName', 'Learner'],
                ['learnerEmail', 'Email'],
                ['masteryPercent', 'Mastery'],
                ['completedTopics', 'Completed Topics'],
                ['examCompletedCount', 'Exams Completed'],
                ['projectSubmittedCount', 'Project Submits'],
                ['totalTimeSpent', 'Time Spent'],
                ['lastActivityAt', 'Last Activity'],
              ].map(([key, label]) => (
                <th key={key} className="text-left px-3 py-2 font-semibold">
                  <button type="button" className="hover:text-gray-900 whitespace-nowrap" onClick={() => toggleSort(key)}>
                    {sortLabel(key, label)}
                  </button>
                </th>
              ))}
              {canObserveLearners && <th className="text-left px-3 py-2 font-semibold">Observe</th>}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={colSpan} className="px-3 py-4 text-gray-500">
                  Loading MasteryView...
                </td>
              </tr>
            )}
            {!loading && displayedRows.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="px-3 py-4 text-gray-500">
                  No learners found for this filter.
                </td>
              </tr>
            )}
            {!loading &&
              displayedRows.map((row) => (
                <tr key={row.enrollmentId} className="border-t border-gray-100 cursor-pointer hover:bg-gray-50" onClick={() => onSelectLearner(row)}>
                  <td className="px-3 py-2">{row.learnerName || 'Unknown learner'}</td>
                  <td className="px-3 py-2">{row.learnerEmail || '-'}</td>
                  <td className="px-3 py-2">{Number.isFinite(Number(row.masteryPercent)) ? `${Math.round(Number(row.masteryPercent))}%` : '0%'}</td>
                  <td className="px-3 py-2">{Number(row.completedTopics || 0)}</td>
                  <td className="px-3 py-2">{Number(row.examCompletedCount || 0)}</td>
                  <td className="px-3 py-2">{Number(row.projectSubmittedCount || 0)}</td>
                  <td className="px-3 py-2">{formatDuration(row.totalTimeSpent || row.progress?.totalTimeSpent)}</td>
                  <td className="px-3 py-2">{row.lastActivityAt ? new Date(row.lastActivityAt).toLocaleString() : '-'}</td>
                  {canObserveLearners && (
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="px-2 py-1 rounded border border-blue-300 text-blue-700 hover:bg-blue-50 text-xs"
                        onClick={(event) => onObserveLearner(row, event)}
                      >
                        Observe
                      </button>
                    </td>
                  )}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {confirmedFilters.length === 0 && (
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1 || loading} className="px-3 py-1 rounded-md border border-gray-300 text-sm disabled:opacity-50">
            Previous
          </button>
          <span className="text-sm text-gray-600">Page {overview.page || page}</span>
          <button type="button" onClick={() => setPage((prev) => prev + 1)} disabled={!overview.hasMore || loading} className="px-3 py-1 rounded-md border border-gray-300 text-sm disabled:opacity-50">
            Next
          </button>
        </div>
      )}
    </div>
  );
}
