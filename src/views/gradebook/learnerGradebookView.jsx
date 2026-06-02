import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { updateAppBar } from '../../hooks/useAppBarState';
import { TopicIcon } from '../../utils/Icons';

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

export default function LearnerGradebookView({ courseOps }) {
  const navigate = useNavigate();
  const { learnerId: routeLearnerId, courseId: routeCourseId } = useParams();
  const [selectedCourseId, setSelectedCourseId] = React.useState('');
  const [selectedLearner, setSelectedLearner] = React.useState(null);
  const [selectedCourse, setSelectedCourse] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [detailSort, setDetailSort] = React.useState({ key: 'topicTitle', direction: 'course' });
  const [enrolledCourseIds, setEnrolledCourseIds] = React.useState(new Set());

  const courseOpsRef = React.useRef(courseOps);
  courseOpsRef.current = courseOps;

  const user = courseOps?.user;

  const availableCourses = React.useMemo(() => {
    const catalog = courseOpsRef.current?.service?.courseCatalog?.() || [];
    if (!user) return [];
    if (user.isRoot()) return catalog;
    return catalog.filter((entry) => user.isEditor(entry.id) || enrolledCourseIds.has(entry.id));
  }, [enrolledCourseIds, user]);

  React.useEffect(() => {
    updateAppBar({ title: 'Learner Gradebook', tools: null });
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
      }
      return;
    }

    if ((!selectedCourseId || !availableCourses.some((course) => course.id === selectedCourseId)) && availableCourses.length > 0) {
      setSelectedCourseId(availableCourses[0].id);
    }
  }, [availableCourses, routeCourseId, selectedCourseId]);

  React.useEffect(() => {
    let cancelled = false;

    async function loadCourse() {
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

    loadCourse();

    return () => {
      cancelled = true;
    };
  }, [selectedCourseId]);

  React.useEffect(() => {
    let cancelled = false;

    async function loadLearner() {
      if (!selectedCourseId || !routeLearnerId) {
        setSelectedLearner(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const result = await courseOpsRef.current.getGradebookOverview({
          courseId: selectedCourseId,
          learnerId: routeLearnerId,
          page: 1,
          limit: 1,
        });
        if (!cancelled) {
          const rows = Array.isArray(result?.rows) ? result.rows : [];
          setSelectedLearner(rows.length > 0 ? rows[0] : null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message || String(loadError));
          setSelectedLearner(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadLearner();

    return () => {
      cancelled = true;
    };
  }, [selectedCourseId, routeLearnerId]);

  function onCourseChange(value) {
    if (value && routeLearnerId) {
      navigate(`/gradebook/learner/${routeLearnerId}/course/${value}`);
    }
  }

  const instructionTopicSummaries = React.useMemo(() => {
    if (!selectedCourse || !selectedLearner?.progress) return [];

    const topics = Array.isArray(selectedCourse.allTopics) ? selectedCourse.allTopics : [];
    return topics
      .filter((topic) => topic?.id && topic?.type !== 'embedded' && topic?.type !== 'schedule')
      .map((topic) => {
        const topicProgress = selectedLearner.progress[topic.id] || {};
        const interactionIds = Array.isArray(topic.interactions) ? topic.interactions : [];
        const completedInteractions = (topicProgress.interactions || []).filter((id) => interactionIds.includes(id)).length;

        const scores = topicProgress.scores || {};
        const completedSet = new Set(topicProgress.interactions || []);
        const scoreSum = interactionIds.reduce((sum, id) => {
          const score = scores[id];
          if (Number.isFinite(score)) return sum + score;
          if (completedSet.has(id)) return sum + 100;
          return sum;
        }, 0);
        const avgPercent = interactionIds.length > 0 ? Math.round((scoreSum / interactionIds.length) * 100) / 100 : null;

        return {
          topicId: topic.id,
          topicType: topic.type,
          topicTitle: topic.title || 'Untitled topic',
          totalInteractions: interactionIds.length,
          completedInteractions,
          avgPercent,
          latestInteractionAt: topicProgress.lastInteractionAt || null,
          timeSpent: typeof topicProgress.timeSpent === 'number' ? topicProgress.timeSpent : 0,
        };
      });
  }, [selectedCourse, selectedLearner]);

  const sortedInstructionTopicSummaries = React.useMemo(() => {
    if (detailSort.key === 'topicTitle' && detailSort.direction === 'course') {
      return [...instructionTopicSummaries];
    }

    const direction = detailSort.direction === 'desc' ? -1 : 1;
    const items = [...instructionTopicSummaries];

    const compareDate = (left, right) => {
      const leftValue = left ? new Date(left).getTime() : 0;
      const rightValue = right ? new Date(right).getTime() : 0;
      return (leftValue - rightValue) * direction;
    };

    items.sort((a, b) => {
      switch (detailSort.key) {
        case 'avgPercent': {
          const left = Number.isFinite(Number(a.avgPercent)) ? Number(a.avgPercent) : -1;
          const right = Number.isFinite(Number(b.avgPercent)) ? Number(b.avgPercent) : -1;
          return (left - right) * direction;
        }
        case 'completedInteractions': {
          if (a.completedInteractions !== b.completedInteractions) {
            return (a.completedInteractions - b.completedInteractions) * direction;
          }
          return (a.totalInteractions - b.totalInteractions) * direction;
        }
        case 'latestInteractionAt':
          return compareDate(a.latestInteractionAt, b.latestInteractionAt);
        case 'timeSpent':
          return ((a.timeSpent || 0) - (b.timeSpent || 0)) * direction;
        case 'topicTitle':
        default:
          return String(a.topicTitle || '').localeCompare(String(b.topicTitle || '')) * direction;
      }
    });

    return items;
  }, [detailSort.direction, detailSort.key, instructionTopicSummaries]);

  function toggleDetailSort(key) {
    setDetailSort((previous) => {
      if (previous.key !== key) {
        return { key, direction: key === 'topicTitle' ? 'course' : 'asc' };
      }
      if (key === 'topicTitle') {
        const next = { course: 'asc', asc: 'desc', desc: 'course' };
        return { key, direction: next[previous.direction] || 'course' };
      }
      return { key, direction: previous.direction === 'asc' ? 'desc' : 'asc' };
    });
  }

  function detailSortLabel(key, label) {
    if (detailSort.key !== key) return label;
    if (key === 'topicTitle' && detailSort.direction === 'course') return `${label} ↕`;
    return `${label} ${detailSort.direction === 'asc' ? '↑' : '↓'}`;
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
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(`/gradebook/course/${selectedCourseId}`)}
          className="text-sm text-blue-700 hover:text-blue-900 hover:underline"
        >
          ← Course Gradebook
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label htmlFor="learner-gradebook-course" className="block text-sm font-medium text-gray-700 mb-1">
            Course
          </label>
          <select
            id="learner-gradebook-course"
            value={selectedCourseId}
            onChange={(e) => onCourseChange(e.target.value)}
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
          >
            {availableCourses.length === 0 && <option value="">No accessible courses</option>}
            {availableCourses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading && <div className="text-sm text-gray-500">Loading...</div>}

      {!loading && selectedLearner && (
        <div className="border border-gray-200 rounded-md p-4 bg-gray-50">
          <h2 className="text-xl font-semibold text-gray-800">{selectedLearner.learnerName || selectedLearner.learnerEmail || 'Unknown learner'}</h2>
          {selectedLearner.learnerEmail && <p className="text-sm text-gray-500 mt-0.5">{selectedLearner.learnerEmail}</p>}
          <div className="flex flex-wrap gap-6 mt-3 text-sm text-gray-700">
            <span>
              Mastery: <strong>{Math.round(Number(selectedLearner.masteryPercent || 0))}%</strong>
            </span>
            <span>
              Topics completed: <strong>{selectedLearner.completedTopics}</strong>
            </span>
            <span>
              Exams completed: <strong>{selectedLearner.examCompletedCount}</strong>
            </span>
            <span>
              Project submits: <strong>{selectedLearner.projectSubmittedCount}</strong>
            </span>
            <span>
              Time spent: <strong>{formatDuration(selectedLearner.totalTimeSpent || selectedLearner.progress?.totalTimeSpent)}</strong>
            </span>
            {selectedLearner.lastActivityAt && (
              <span>
                Last activity: <strong>{new Date(selectedLearner.lastActivityAt).toLocaleString()}</strong>
              </span>
            )}
          </div>
        </div>
      )}

      {!loading && !selectedLearner && !error && selectedCourseId && (
        <div className="text-sm text-gray-500">No enrollment data found for this learner in this course.</div>
      )}

      {!loading && instructionTopicSummaries.length > 0 && (
        <div className="overflow-auto border border-gray-200 rounded-md">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">
                  <button type="button" className="hover:text-gray-900" onClick={() => toggleDetailSort('topicTitle')} aria-label="Sort by instruction item">
                    {detailSortLabel('topicTitle', 'Instruction Item')}
                  </button>
                </th>
                <th className="text-left px-3 py-2 font-semibold">
                  <button type="button" className="hover:text-gray-900" onClick={() => toggleDetailSort('avgPercent')} aria-label="Sort by mastery">
                    {detailSortLabel('avgPercent', 'Mastery')}
                  </button>
                </th>
                <th className="text-left px-3 py-2 font-semibold">
                  <button type="button" className="hover:text-gray-900" onClick={() => toggleDetailSort('completedInteractions')} aria-label="Sort by interactions completed">
                    {detailSortLabel('completedInteractions', 'Interactions Completed')}
                  </button>
                </th>
                <th className="text-left px-3 py-2 font-semibold">
                  <button type="button" className="hover:text-gray-900" onClick={() => toggleDetailSort('timeSpent')} aria-label="Sort by time spent">
                    {detailSortLabel('timeSpent', 'Time Spent')}
                  </button>
                </th>
                <th className="text-left px-3 py-2 font-semibold">
                  <button type="button" className="hover:text-gray-900" onClick={() => toggleDetailSort('latestInteractionAt')} aria-label="Sort by last interaction">
                    {detailSortLabel('latestInteractionAt', 'Last Interaction')}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedInstructionTopicSummaries.map((summary) => (
                <tr key={summary.topicId} className="border-t border-gray-100 text-gray-700">
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/course/${selectedCourseId}/topic/${summary.topicId}`)}
                      className="text-left text-blue-700 hover:text-blue-900 hover:underline inline-flex items-center gap-1"
                    >
                      <TopicIcon type={summary.topicType} />
                      {summary.topicTitle}
                    </button>
                  </td>
                  <td className="px-3 py-2">{summary.avgPercent !== null ? `${summary.avgPercent}%` : '-'}</td>
                  <td className="px-3 py-2">
                    {summary.completedInteractions}/{summary.totalInteractions}
                  </td>
                  <td className="px-3 py-2">{formatDuration(summary.timeSpent)}</td>
                  <td className="px-3 py-2">{summary.latestInteractionAt ? new Date(summary.latestInteractionAt).toLocaleString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
