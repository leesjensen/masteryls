import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { updateAppBar } from '../../hooks/useAppBarState';
import { TopicIcon } from '../../utils/Icons';

function canAccessCourse(user, courseId) {
  if (!user || !courseId) {
    return false;
  }
  return user.isRoot() || user.isEditor(courseId);
}

export default function GradebookView({ courseOps }) {
  const navigate = useNavigate();
  const { courseId: routeCourseId } = useParams();
  const [selectedCourseId, setSelectedCourseId] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [overview, setOverview] = React.useState({ rows: [], totalCount: 0, page: 1, limit: 50, hasMore: false });
  const [selectedLearner, setSelectedLearner] = React.useState(null);
  const [selectedCourse, setSelectedCourse] = React.useState(null);
  const [expandedEnrollmentId, setExpandedEnrollmentId] = React.useState(null);
  const [learnerDetailsLoading, setLearnerDetailsLoading] = React.useState(false);
  const [learnerDetailsError, setLearnerDetailsError] = React.useState(null);
  const [learnerProgressRows, setLearnerProgressRows] = React.useState([]);

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
        const course = await courseOps.getCourse(selectedCourseId);
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
  }, [courseOps, selectedCourseId]);

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
    if (value) {
      navigate(`/gradebook/course/${value}`);
    } else {
      navigate('/gradebook');
    }
    setPage(1);
    setExpandedEnrollmentId(null);
    setSelectedLearner(null);
    setLearnerProgressRows([]);
    setLearnerDetailsError(null);
  }

  async function toggleLearnerDetails(row) {
    if (!selectedCourseId || !row?.enrollmentId) {
      return;
    }

    if (expandedEnrollmentId === row.enrollmentId) {
      setExpandedEnrollmentId(null);
      setSelectedLearner(null);
      setLearnerProgressRows([]);
      setLearnerDetailsError(null);
      return;
    }

    setExpandedEnrollmentId(row.enrollmentId);
    setSelectedLearner(row);
    setLearnerDetailsLoading(true);
    setLearnerDetailsError(null);

    try {
      const result = await courseOps.getProgress({ courseId: selectedCourseId, enrollmentId: row.enrollmentId, page: 1, limit: 25 });
      setLearnerProgressRows(Array.isArray(result?.data) ? result.data : []);
    } catch (loadError) {
      setLearnerDetailsError(loadError.message || String(loadError));
      setLearnerProgressRows([]);
    } finally {
      setLearnerDetailsLoading(false);
    }
  }

  const instructionTopicSummaries = React.useMemo(() => {
    if (!selectedLearner || !selectedCourse) {
      return [];
    }

    const topics = Array.isArray(selectedCourse.allTopics) ? selectedCourse.allTopics : [];
    const instructionTopics = topics.filter((topic) => topic?.id && topic?.type !== 'embedded' && topic?.type !== 'schedule');

    return instructionTopics.map((topic) => {
      const topicRows = learnerProgressRows.filter((item) => String(item?.topicId || '') === String(topic.id));
      const interactionRows = topicRows.filter((item) => String(item?.type || '') === 'quizSubmit');
      const interactionIds = Array.isArray(topic?.interactions) ? topic.interactions.map((id) => String(id)) : [];
      const completedInteractionIds = new Set(interactionRows.map((item) => String(item?.interactionId || '')).filter((interactionId) => interactionId && interactionIds.includes(interactionId)));
      const totalInteractions = interactionIds.length;
      const completedInteractions = completedInteractionIds.size;

      const latestInteractionById = new Map();
      interactionRows.forEach((item) => {
        const interactionId = String(item?.interactionId || '');
        if (!interactionId || !interactionIds.includes(interactionId)) {
          return;
        }
        const existing = latestInteractionById.get(interactionId);
        if (!existing || String(item?.createdAt || '') > String(existing?.createdAt || '')) {
          latestInteractionById.set(interactionId, item);
        }
      });
      const totalPercent = interactionIds.reduce((sum, interactionId) => {
        const row = latestInteractionById.get(interactionId);
        const value = Number(row?.details?.percentCorrect);
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0);
      const avgPercent = totalInteractions > 0 ? Math.round((totalPercent / totalInteractions) * 100) / 100 : null;
      const latestInteraction = interactionRows.slice().sort((a, b) => String(b?.createdAt || '').localeCompare(String(a?.createdAt || '')))[0];

      return {
        topicId: topic.id,
        topicType: topic.type,
        topicTitle: topic.title || 'Untitled topic',
        interactionCount: interactionRows.length,
        totalInteractions,
        completedInteractions,
        avgPercent,
        latestInteractionAt: latestInteraction?.createdAt || null,
      };
    });
  }, [selectedCourse, selectedLearner, learnerProgressRows]);

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
              overview.rows.map((row) => {
                const isExpanded = expandedEnrollmentId === row.enrollmentId;
                return (
                  <React.Fragment key={row.enrollmentId}>
                    <tr className={`border-t border-gray-100 cursor-pointer ${isExpanded ? 'bg-amber-50/40' : 'hover:bg-gray-50'}`} onClick={() => toggleLearnerDetails(row)}>
                      <td className="px-3 py-2">{row.learnerName || 'Unknown learner'}</td>
                      <td className="px-3 py-2">{row.learnerEmail || '-'}</td>
                      <td className="px-3 py-2">{Number.isFinite(Number(row.masteryPercent)) ? `${Math.round(Number(row.masteryPercent))}%` : '0%'}</td>
                      <td className="px-3 py-2">{Number(row.completedTopics || 0)}</td>
                      <td className="px-3 py-2">{Number(row.examCompletedCount || 0)}</td>
                      <td className="px-3 py-2">{Number(row.projectSubmittedCount || 0)}</td>
                      <td className="px-3 py-2">{row.lastActivityAt ? new Date(row.lastActivityAt).toLocaleString() : '-'}</td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-t border-gray-100 bg-amber-50/20">
                        <td colSpan={7} className="px-4 py-3">
                          {learnerDetailsLoading && <div className="text-sm text-gray-500">Loading instruction details...</div>}
                          {!learnerDetailsLoading && learnerDetailsError && <div className="text-sm text-red-700">{learnerDetailsError}</div>}
                          {!learnerDetailsLoading && !learnerDetailsError && instructionTopicSummaries.length === 0 && <div className="text-sm text-gray-500">No instruction items found for this course.</div>}
                          {!learnerDetailsLoading && !learnerDetailsError && instructionTopicSummaries.length > 0 && (
                            <div className="overflow-auto border border-gray-200 rounded-md bg-white">
                              <table className="min-w-full text-sm">
                                <thead className="bg-gray-50 text-gray-700">
                                  <tr>
                                    <th className="text-left px-2 py-1 font-semibold">Instruction Item</th>
                                    <th className="text-left px-2 py-1 font-semibold">Mastery</th>
                                    <th className="text-left px-2 py-1 font-semibold">Interactions Completed</th>
                                    <th className="text-left px-2 py-1 font-semibold">Last Interaction</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {instructionTopicSummaries.map((summary) => (
                                    <tr key={summary.topicId} className="border-t border-gray-100 text-gray-700">
                                      <td className="px-2 py-1">
                                        <button type="button" onClick={() => navigate(`/course/${selectedCourseId}/topic/${summary.topicId}`)} className="text-left text-blue-700 hover:text-blue-900 hover:underline inline-flex items-center gap-1">
                                          <TopicIcon type={summary.topicType} />
                                          {summary.topicTitle}
                                        </button>
                                      </td>
                                      <td className="px-2 py-1">{summary.avgPercent !== null ? `${summary.avgPercent}%` : '-'}</td>
                                      <td className="px-2 py-1">
                                        {summary.completedInteractions}/{summary.totalInteractions}
                                      </td>
                                      <td className="px-2 py-1">{summary.latestInteractionAt ? new Date(summary.latestInteractionAt).toLocaleString() : '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
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
