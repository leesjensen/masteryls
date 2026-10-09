import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { updateAppBar } from '../../hooks/useAppBarState';
import { deriveProgressSummary } from '../../utils/progressSummary.js';

const PAGE_SIZE = 50;

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

// Normalizes a schedule date (YYYY-MM-DD or any parseable date) to a YYYY-MM-DD value for a
// native date input, or '' when absent/unparseable.
function toDateInputValue(value) {
  if (!value) return '';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// The active/default schedule's inclusive span as date-input values (empty when undated).
function scheduleDefaultRange(course) {
  const files = Array.isArray(course?.schedule?.files) ? course.schedule.files : [];
  const schedule = files.find((file) => file.default) || files[0];
  return { start: toDateInputValue(schedule?.startDate), end: toDateInputValue(schedule?.endDate) };
}

// Compares two already-derived rows by a column. Names/emails are trimmed so a stray leading
// space (invisible in the table, but significant to localeCompare) can't push a learner to an
// extreme; dates and the numeric columns compare naturally.
function compareRows(a, b, key) {
  switch (key) {
    case 'learnerName':
      return String(a.learnerName || '').trim().localeCompare(String(b.learnerName || '').trim());
    case 'learnerEmail':
      return String(a.learnerEmail || '').trim().localeCompare(String(b.learnerEmail || '').trim());
    case 'lastActivityAt': {
      const ad = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
      const bd = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
      return ad - bd;
    }
    default:
      return Number(a[key] || 0) - Number(b[key] || 0);
  }
}

export default function MasteryView({ courseOps, startObserveSession = null }) {
  const navigate = useNavigate();
  const { courseId: routeCourseId } = useParams();
  const [selectedCourseId, setSelectedCourseId] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  // The full set of enrollments for the course (identity + trimmed progress). The client derives
  // metrics, then sorts/filters/paginates locally so ordering always matches the displayed values.
  const [allRows, setAllRows] = React.useState([]);
  const [enrolledCourseIds, setEnrolledCourseIds] = React.useState(new Set());
  const [filterText, setFilterText] = React.useState('');
  // Inclusive "enrolled between" window (YYYY-MM-DD strings; '' means unbounded). Defaults to the
  // selected schedule's span. The server restricts the roster to enrollments created in this
  // window, so changing it refetches.
  const [range, setRange] = React.useState({ start: '', end: '' });
  // The schedule file whose span currently drives the range ('' = a manual/custom range).
  const [selectedScheduleId, setSelectedScheduleId] = React.useState('');
  const [sort, setSort] = React.useState({ key: null, direction: 'asc' });
  const [selectedCourse, setSelectedCourse] = React.useState(null);
  // The courseId whose schedule window is currently applied to `range`. The roster fetch waits
  // until this matches selectedCourseId, so the first request already carries the schedule window
  // (and never fires with a stale/empty window during a course switch).
  const [rangeCourseId, setRangeCourseId] = React.useState(null);

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

  // Derive every displayed/sorted metric from the trimmed progress once per course load. This is
  // the single source of truth - the table never sorts on values it doesn't display.
  const derivedRows = React.useMemo(
    () =>
      allRows.map((row) => {
        const summary = deriveProgressSummary(row.progress, selectedCourse);
        return {
          enrollmentId: row.enrollmentId,
          learnerId: row.learnerId,
          learnerName: row.learnerName,
          learnerEmail: row.learnerEmail,
          masteryPercent: summary.mastery,
          completedTopics: summary.completedTopics,
          examCompletedCount: summary.examCompletedCount,
          projectSubmittedCount: summary.projectSubmittedCount,
          totalTimeSpent: summary.totalTimeSpent,
          lastActivityAt: summary.lastActivityAt,
        };
      }),
    [allRows, selectedCourse],
  );

  // The date window is applied server-side (by enrollment date), so the client only text-filters.
  const filteredRows = React.useMemo(() => {
    const query = filterText.trim().toLowerCase();
    if (!query) return derivedRows;
    return derivedRows.filter((row) => String(row.learnerName || '').toLowerCase().includes(query) || String(row.learnerEmail || '').toLowerCase().includes(query));
  }, [derivedRows, filterText]);

  const sortedRows = React.useMemo(() => {
    if (!sort.key) return filteredRows;
    const dir = sort.direction === 'desc' ? -1 : 1;
    return [...filteredRows].sort((a, b) => compareRows(a, b, sort.key) * dir);
  }, [filteredRows, sort]);

  const displayedRows = React.useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedRows.slice(start, start + PAGE_SIZE);
  }, [sortedRows, page]);

  const hasMore = page * PAGE_SIZE < sortedRows.length;

  React.useEffect(() => {
    updateAppBar({ title: 'MasteryView', tools: null });
  }, []);

  // Keep the current page in range as the filtered/sorted set shrinks (e.g. filtering or unenroll).
  React.useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [sortedRows.length, page]);

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

  // Load the course and seed the date window from its default schedule in one step, so the first
  // roster fetch already carries the schedule window. rangeCourseId is set only once the window is
  // ready, which gates the roster fetch below until then.
  React.useEffect(() => {
    let cancelled = false;

    async function loadSelectedCourse() {
      if (!selectedCourseId) {
        if (!cancelled) {
          setSelectedCourse(null);
          setRange({ start: '', end: '' });
          setSelectedScheduleId('');
          setRangeCourseId('');
        }
        return;
      }

      try {
        const course = await courseOpsRef.current.getCourse(selectedCourseId);
        if (cancelled) return;
        const files = Array.isArray(course?.schedule?.files) ? course.schedule.files : [];
        const defaultSchedule = files.find((file) => file.default) || files[0];
        setSelectedCourse(course || null);
        setSelectedScheduleId(defaultSchedule?.id || '');
        setRange(scheduleDefaultRange(course));
        setPage(1);
        setRangeCourseId(selectedCourseId);
      } catch {
        if (!cancelled) {
          setSelectedCourse(null);
          setRange({ start: '', end: '' });
          setSelectedScheduleId('');
          setRangeCourseId(selectedCourseId);
        }
      }
    }

    loadSelectedCourse();

    return () => {
      cancelled = true;
    };
  }, [selectedCourseId]);

  // The enrolled-between window as inclusive ISO bounds for the server (local day boundaries).
  const rangeStartIso = range.start ? new Date(`${range.start}T00:00:00`).toISOString() : '';
  const rangeEndIso = range.end ? new Date(`${range.end}T23:59:59.999`).toISOString() : '';

  // Fetch the roster, scoped to the enrolled-between window. Refetches when the window changes;
  // sorting, text filtering and pagination all happen client-side against the returned set. Waits
  // for the course to resolve so the first fetch already carries the schedule-default window.
  React.useEffect(() => {
    let cancelled = false;

    async function loadOverview() {
      // Wait until the schedule window for THIS course is applied (rangeCourseId === selectedCourseId),
      // so the first request carries the right window and a course switch never fires a stale fetch.
      if (!selectedCourseId || !hasCourseAccess || rangeCourseId !== selectedCourseId) {
        if (!cancelled && (!selectedCourseId || !hasCourseAccess)) {
          setAllRows([]);
        }
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const result = await courseOpsRef.current.getMasteryOverview({ courseId: selectedCourseId, startDate: rangeStartIso, endDate: rangeEndIso });
        if (!cancelled) {
          setAllRows(Array.isArray(result?.rows) ? result.rows : []);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message || String(loadError));
          setAllRows([]);
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
  }, [hasCourseAccess, selectedCourseId, rangeCourseId, rangeStartIso, rangeEndIso]);

  function toggleSort(key) {
    setSort((prev) => (prev.key === key ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' }));
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
      setAllRows((prev) => prev.filter((r) => r.enrollmentId !== row.enrollmentId));
    } catch (unenrollError) {
      setError(unenrollError.message || String(unenrollError));
    }
  }

  // Pick a schedule from the dropdown: its span becomes the enrolled-between window.
  function onScheduleSelect(scheduleId) {
    setSelectedScheduleId(scheduleId);
    const files = Array.isArray(selectedCourse?.schedule?.files) ? selectedCourse.schedule.files : [];
    const file = files.find((entry) => entry.id === scheduleId);
    setRange(file ? { start: toDateInputValue(file.startDate), end: toDateInputValue(file.endDate) } : { start: '', end: '' });
    setPage(1);
  }

  // Manual edit of a From/To field detaches the window from any schedule (custom range).
  function onRangeFieldChange(field, value) {
    setRange((prev) => ({ ...prev, [field]: value }));
    setSelectedScheduleId('');
    setPage(1);
  }

  function onClearRange() {
    setRange({ start: '', end: '' });
    setSelectedScheduleId('');
    setPage(1);
  }

  if (!user) {
    return (
      <div className="flex-1 m-6 flex flex-col bg-white border border-gray-200 rounded-md p-6">
        <p className="text-gray-700">Please log in to view MasteryView.</p>
      </div>
    );
  }

  const colSpan = hasActions ? 9 : 8;
  const isFiltering = filterText.trim().length > 0;
  const invalidRange = Boolean(range.start && range.end && range.start > range.end);
  const scheduleFiles = Array.isArray(selectedCourse?.schedule?.files) ? selectedCourse.schedule.files : [];
  // Also show the loading row while the course (and its schedule window) is still resolving.
  const showLoading = loading || (Boolean(selectedCourseId) && hasCourseAccess && rangeCourseId !== selectedCourseId);

  function renderPagination() {
    return (
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1 || loading} className="px-3 py-1 rounded-md border border-gray-300 text-sm disabled:opacity-50">
          Previous
        </button>
        <span className="text-sm text-gray-600">Page {page}</span>
        <button type="button" onClick={() => setPage((prev) => prev + 1)} disabled={!hasMore || loading} className="px-3 py-1 rounded-md border border-gray-300 text-sm disabled:opacity-50">
          Next
        </button>
      </div>
    );
  }

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
                setPage(1);
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
            <span>{isFiltering ? 'Matching learners' : 'Total learners'}: {isFiltering ? filteredRows.length : derivedRows.length}</span>
          </div>
        )}
      </div>

      {canViewLearnerFilters && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-sm font-medium text-gray-700">Enrolled between</span>
          {scheduleFiles.length > 0 && (
            <div className="flex items-center gap-1">
              <label htmlFor="masteryview-schedule" className="text-sm text-gray-600">
                Schedule
              </label>
              <select
                id="masteryview-schedule"
                value={selectedScheduleId}
                onChange={(e) => onScheduleSelect(e.target.value)}
                className="px-2 py-1 border border-gray-200 rounded text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                aria-label="Schedule"
              >
                <option value="">Custom</option>
                {scheduleFiles.map((file) => (
                  <option key={file.id} value={file.id}>
                    {file.title || 'Schedule'}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center gap-1">
            <label htmlFor="masteryview-start" className="text-sm text-gray-600">
              From
            </label>
            <input
              id="masteryview-start"
              type="date"
              value={range.start}
              onChange={(e) => onRangeFieldChange('start', e.target.value)}
              className="px-2 py-1 border border-gray-200 rounded text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
              aria-label="Enrolled start date"
            />
          </div>
          <div className="flex items-center gap-1">
            <label htmlFor="masteryview-end" className="text-sm text-gray-600">
              To
            </label>
            <input
              id="masteryview-end"
              type="date"
              value={range.end}
              onChange={(e) => onRangeFieldChange('end', e.target.value)}
              className="px-2 py-1 border border-gray-200 rounded text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
              aria-label="Enrolled end date"
            />
          </div>
          <button
            type="button"
            onClick={onClearRange}
            className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700 text-xs"
            title="Clear the date range (all enrollments)"
          >
            All dates
          </button>
          {invalidRange && <span className="text-xs text-red-600">Start date must be before end date</span>}
        </div>
      )}

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {renderPagination()}

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
            {showLoading && (
              <tr>
                <td colSpan={colSpan} className="px-3 py-4 text-gray-500">
                  Loading MasteryView...
                </td>
              </tr>
            )}
            {!showLoading && displayedRows.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="px-3 py-4 text-gray-500">
                  No learners found for this filter.
                </td>
              </tr>
            )}
            {!showLoading &&
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

      {renderPagination()}
    </div>
  );
}
