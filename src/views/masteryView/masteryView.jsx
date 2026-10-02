import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { updateAppBar } from '../../hooks/useAppBarState';
import { deriveProgressSummary } from '../../utils/progressSummary.js';

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
  const [searchText, setSearchText] = React.useState('');
  const [sort, setSort] = React.useState({ key: null, direction: 'asc' });
  const [selectedCourse, setSelectedCourse] = React.useState(null);

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
    return selectedCourseId ? user.canOverseeCourse?.(selectedCourseId) : user.isEditor() || user.isMentor?.();
  }, [user, selectedCourseId]);

  const availableCourses = React.useMemo(() => {
    const catalog = courseOpsRef.current?.service?.courseCatalog?.() || [];
    if (!user) {
      return [];
    }
    if (user.isRoot()) {
      return catalog;
    }
    return catalog.filter((entry) => user.canOverseeCourse?.(entry.id) || enrolledCourseIds.has(entry.id));
  }, [enrolledCourseIds, user]);

  const hasCourseAccess = React.useMemo(() => {
    if (!user || !selectedCourseId) {
      return false;
    }
    return user.canOverseeCourse?.(selectedCourseId) || enrolledCourseIds.has(selectedCourseId);
  }, [enrolledCourseIds, selectedCourseId, user]);
  const canObserveLearners = React.useMemo(() => Boolean(user && selectedCourseId && user.canOverseeCourse?.(selectedCourseId)), [user, selectedCourseId]);
  const canUnenrollLearners = React.useMemo(() => Boolean(user && selectedCourseId && (user.isRoot?.() || user.isEditor?.(selectedCourseId))), [user, selectedCourseId]);
  const hasActions = canObserveLearners || canUnenrollLearners;

  const displayedRows = React.useMemo(
    () =>
      overview.rows.map((row) => {
        const summary = deriveProgressSummary(row.progress, selectedCourse);
        const hasTopicProgress = summary.completedTopics > 0;
        return {
          ...row,
          masteryPercent: hasTopicProgress || !Number.isFinite(Number(row.masteryPercent)) ? summary.mastery : Number(row.masteryPercent),
          completedTopics: hasTopicProgress || !Number.isFinite(Number(row.completedTopics)) ? summary.completedTopics : Number(row.completedTopics),
          totalTimeSpent: hasTopicProgress || !Number.isFinite(Number(row.totalTimeSpent)) ? summary.totalTimeSpent : Number(row.totalTimeSpent),
          lastActivityAt: summary.lastActivityAt || row.lastActivityAt,
        };
      }),
    [overview.rows, selectedCourse],
  );

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

    async function loadSelectedCourse() {
      if (!selectedCourseId) {
        setSelectedCourse(null);
        return;
      }

      try {
        const course = await courseOpsRef.current.getCourse(selectedCourseId);
        if (!cancelled) {
          setSelectedCourse(course || null);
        }
      } catch {
        if (!cancelled) {
          setSelectedCourse(null);
        }
      }
    }

    loadSelectedCourse();

    return () => {
      cancelled = true;
    };
  }, [selectedCourseId]);

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
        const result = await courseOpsRef.current.getMasteryOverview({ courseId: selectedCourseId, page, limit: 50, search: searchText, sortKey: sort.key || '', sortDirection: sort.direction });
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
  }, [hasCourseAccess, selectedCourseId, page, searchText, sort.key, sort.direction]);

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      setSearchText(filterText.trim());
      setPage(1);
    }, 800);

    return () => clearTimeout(timeout);
  }, [filterText]);

  function toggleSort(key) {
    setSort((prev) => prev.key === key ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' });
    setPage(1);
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
    setFilterText('');
    setSearchText('');
    setSort({ key: null, direction: 'asc' });
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

  async function onUnenrollLearner(row, event) {
    event?.stopPropagation?.();
    if (!canUnenrollLearners || !row?.enrollmentId) {
      return;
    }
    const learnerLabel = row.learnerName || row.learnerEmail || 'this learner';
    if (!window.confirm(`Unenroll ${learnerLabel} from this course? Their progress and submissions will no longer be accessible.`)) {
      return;
    }
    try {
      await courseOpsRef.current.unenrollLearner({ enrollmentId: row.enrollmentId });
      setOverview((prev) => ({
        ...prev,
        rows: prev.rows.filter((r) => r.enrollmentId !== row.enrollmentId),
        totalCount: Math.max(0, Number(prev.totalCount || 0) - 1),
      }));
    } catch (unenrollError) {
      setError(unenrollError.message || String(unenrollError));
    }
  }

  if (!user) {
    return (
      <div className="flex-1 m-6 flex flex-col bg-white border border-gray-200 rounded-md p-6">
        <p className="text-gray-700">Please log in to view MasteryView.</p>
      </div>
    );
  }

  const colSpan = hasActions ? 9 : 8;

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
              }}
              placeholder="Name or email"
              autoComplete="off"
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
              aria-label="Filter learner"
            />
          </div>
        )}

        {canViewLearnerFilters && (
          <div className="flex items-end text-sm text-gray-600">
            <span>{searchText ? 'Matching learners' : 'Total learners'}: {overview.totalCount}</span>
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
              {hasActions && <th className="text-left px-3 py-2 font-semibold">Actions</th>}
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
                  <td className="px-3 py-2">{formatDuration(row.totalTimeSpent)}</td>
                  <td className="px-3 py-2">{row.lastActivityAt ? new Date(row.lastActivityAt).toLocaleString() : '-'}</td>
                  {hasActions && (
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {canObserveLearners && (
                          <button
                            type="button"
                            className="px-2 py-1 rounded border border-blue-300 text-blue-700 hover:bg-blue-50 text-xs"
                            onClick={(event) => onObserveLearner(row, event)}
                          >
                            Observe
                          </button>
                        )}
                        {canUnenrollLearners && (
                          <button
                            type="button"
                            className="px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50 text-xs"
                            onClick={(event) => onUnenrollLearner(row, event)}
                          >
                            Unenroll
                          </button>
                        )}
                      </div>
                    </td>
                  )}
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
