import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateAppBar } from '../../hooks/useAppBarState';

export default function ProgressView({ courseOps, service, user }) {
  const navigate = useNavigate();
  const [progressRecords, setProgressRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState({
    type: '',
    courseId: '',
    startDate: '',
    endDate: '',
  });
  const [sortConfig, setSortConfig] = useState({
    key: 'createdAt',
    direction: 'desc',
  });
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(100);
  const [groupedRecords, setGroupedRecords] = useState([]);
  const [groupingInProgress, setGroupingInProgress] = useState(false);
  const [paginationInfo, setPaginationInfo] = useState({
    totalRecords: 0,
    hasMore: false,
    currentPage: 1,
  });

  const appBarTools = (
    <button title="Close progress dashboard" onClick={() => navigate('/dashboard')} className="w-6 m-0.5 p-0.5 text-xs font-medium rounded-xs bg-white border border-gray-300 filter grayscale hover:grayscale-0 hover:border-gray-200 hover:shadow-sm transition-all duration-200 ease-in-out">
      ❌
    </button>
  );

  useEffect(() => {
    updateAppBar('Progress', appBarTools);
  }, []);

  useEffect(() => {
    fetchProgressData();
  }, [user]);

  const fetchProgressData = async (page = currentPage) => {
    if (!user || !courseOps) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get paginated progress records for the current user
      const progressSearchResult = await courseOps.getProgress({
        userId: user.id,
        page: page,
        limit: itemsPerPage,
        ...filter,
      });

      // Extract data and pagination info from the response
      const { data = [], hasMore = false, totalCount = 0 } = progressSearchResult;

      setProgressRecords(data);
      setPaginationInfo({
        totalRecords: totalCount,
        hasMore: hasMore,
        currentPage: page,
      });
    } catch (err) {
      setError(`Failed to fetch progress data: ${err.message}`);
      console.error('Error fetching progress:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilter((prev) => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    setCurrentPage(1); // Reset to first page when applying filters
    fetchProgressData(1);
  };

  const clearFilters = () => {
    setFilter({
      type: '',
      courseId: '',
      startDate: '',
      endDate: '',
    });
    setCurrentPage(1); // Reset to first page when clearing filters
    setTimeout(() => fetchProgressData(1), 0);
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const getTitles = async (courseId, topicId) => {
    const course = courseId && (await courseOps.getCourse(courseId));
    if (!course) return { course: 'N/A', topic: 'N/A' };

    const topic = topicId && course.topicFromId(topicId);
    return { course: course.title, topic: topic ? topic.title : 'N/A' };
  };

  const sortedRecords = React.useMemo(() => {
    if (!progressRecords.length) return [];

    return [...progressRecords].sort((a, b) => {
      const { key, direction } = sortConfig;
      let aVal = a[key];
      let bVal = b[key];

      // Handle date sorting
      if (key === 'createdAt') {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      }

      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [progressRecords, sortConfig]);

  // Group consecutive events with the same course and type (async)
  useEffect(() => {
    const groupRecords = async () => {
      if (!sortedRecords.length) {
        setGroupedRecords([]);
        return;
      }

      setGroupingInProgress(true);

      try {
        const groups = [];
        let currentGroup = null;

        for (let i = 0; i < sortedRecords.length; i++) {
          const record = sortedRecords[i];

          // Get titles for course and topic
          const { course: courseTitle, topic: topicTitle } = await getTitles(record.catalogId, record.topicId);
          record.courseTitle = courseTitle;
          record.topicTitle = topicTitle;

          const groupKey = `${record.catalogId || 'no-course'}-${record.type}-${record.topicId || 'no-topic'}`;

          // Check if this record should be grouped with the previous one
          const shouldGroup =
            currentGroup &&
            currentGroup.groupKey === groupKey &&
            // Only group if events are within a reasonable time window (e.g., 1 hour)
            new Date(record.createdAt) - new Date(currentGroup.lastEvent.createdAt) < 3600000;

          if (shouldGroup) {
            currentGroup.events.push(record);
            currentGroup.totalDuration += record.duration || 0;
            currentGroup.lastEvent = record;
            currentGroup.eventCount++;
          } else {
            // Start a new group
            currentGroup = {
              id: `group-${i}`,
              groupKey,
              type: record.type,
              catalogId: record.catalogId,
              topicId: record.topicId,
              courseTitle: record.courseTitle,
              topicTitle: record.topicTitle,
              firstEvent: record,
              lastEvent: record,
              events: [record],
              totalDuration: record.duration || 0,
              eventCount: 1,
              createdAt: record.createdAt, // Use first event's timestamp for sorting
            };
            groups.push(currentGroup);
          }
        }

        setGroupedRecords(groups);
      } catch (error) {
        console.error('Error grouping records:', error);
        setGroupedRecords([]);
      } finally {
        setGroupingInProgress(false);
      }
    };

    groupRecords();
  }, [sortedRecords, courseOps]);

  const toggleGroupExpansion = (groupId) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  // Pagination logic - now using server-side pagination
  const paginatedRecords = groupedRecords; // All records are already paginated from server

  const totalPages = Math.ceil(paginationInfo.totalRecords / itemsPerPage);

  const goToPage = (page) => {
    if (page !== currentPage && page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      setExpandedGroups(new Set()); // Collapse all groups when changing pages
      fetchProgressData(page); // Fetch new page from server
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (paginationInfo.hasMore) {
      goToPage(currentPage + 1);
    }
  };

  // Reset to first page and refetch when filters or sorting change
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
      setExpandedGroups(new Set());
      fetchProgressData(1);
    } else {
      fetchProgressData(currentPage);
    }
  }, [filter, sortConfig]);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0s';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  };

  const getActivityTypeColor = (type) => {
    const colors = {
      instructionView: 'bg-blue-100 text-blue-800',
      videoView: 'bg-purple-100 text-purple-800',
      quizSubmit: 'bg-green-100 text-green-800',
      exam: 'bg-red-100 text-red-800',
      userLogout: 'bg-gray-100 text-gray-800',
      default: 'bg-gray-100 text-gray-800',
    };
    return colors[type] || colors.default;
  };

  if (!user) {
    return (
      <div className="flex-1 m-6 flex flex-col bg-white">
        <main className="flex-1 overflow-auto p-2 border border-gray-200">
          <div className="text-center text-gray-500 mt-8">Please log in to view your progress.</div>
        </main>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 m-6 flex flex-col bg-white">
        <main className="flex-1 overflow-auto p-4 border border-gray-200">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Your Learning Progress</h1>

            {/* Filters */}
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <h2 className="text-lg font-semibold mb-3">Filters</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Activity Type</label>
                  <select value={filter.type} onChange={(e) => handleFilterChange('type', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">All Types</option>
                    <option value="instructionView">Instruction View</option>
                    <option value="videoView">Video View</option>
                    <option value="quizSubmit">Quiz Submit</option>
                    <option value="exam">Exam</option>
                    <option value="userLogout">User Logout</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input type="datetime-local" value={filter.startDate} onChange={(e) => handleFilterChange('startDate', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input type="datetime-local" value={filter.endDate} onChange={(e) => handleFilterChange('endDate', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div className="flex items-end gap-2">
                  <button onClick={applyFilters} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    Apply
                  </button>
                  <button onClick={clearFilters} className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500">
                    Clear
                  </button>
                </div>
              </div>
            </div>

            {/* Loading State */}
            {(loading || groupingInProgress) && (
              <div className="text-center py-8">
                <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                <p className="mt-2 text-gray-600">{loading ? 'Loading progress data...' : 'Processing and grouping records...'}</p>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <p className="text-red-800">{error}</p>
                <button onClick={fetchProgressData} className="mt-2 px-3 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200">
                  Retry
                </button>
              </div>
            )}

            {/* Progress Table */}
            {!loading && !error && !groupingInProgress && (
              <>
                <div className="mb-4 flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    Showing {paginatedRecords.length} of {paginationInfo.totalRecords} progress record{paginationInfo.totalRecords !== 1 ? 's' : ''}
                    {totalPages > 1 && (
                      <span className="ml-2">
                        (Page {paginationInfo.currentPage} of {totalPages})
                      </span>
                    )}
                  </div>

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center space-x-2">
                      <button onClick={goToPreviousPage} disabled={currentPage === 1} className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed">
                        Previous
                      </button>

                      <div className="flex items-center space-x-1">
                        {/* Show page numbers */}
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (paginationInfo.currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (paginationInfo.currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = paginationInfo.currentPage - 2 + i;
                          }

                          return (
                            <button key={pageNum} onClick={() => goToPage(pageNum)} className={`px-3 py-1 text-sm rounded ${paginationInfo.currentPage === pageNum ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>

                      <button onClick={goToNextPage} disabled={!paginationInfo.hasMore} className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed">
                        Next
                      </button>
                    </div>
                  )}
                </div>

                {paginatedRecords.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No progress records found. Start learning to see your progress here!</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expand</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('createdAt')}>
                            Date & Time Range
                            {sortConfig.key === 'createdAt' && <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('type')}>
                            Activity Type
                            {sortConfig.key === 'type' && <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Topic</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Events</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('duration')}>
                            Total Duration
                            {sortConfig.key === 'duration' && <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {paginatedRecords.map((group) => (
                          <React.Fragment key={group.id}>
                            {/* Group Row */}
                            <tr className={`hover:bg-gray-50 ${group.eventCount > 1 ? 'bg-blue-50' : ''}`}>
                              <td className="px-6 py-2 whitespace-nowrap">
                                {group.eventCount > 1 ? (
                                  <button onClick={() => toggleGroupExpansion(group.id)} className="text-blue-600 hover:text-blue-800 focus:outline-none">
                                    {expandedGroups.has(group.id) ? '▼' : '▶'}
                                  </button>
                                ) : (
                                  <span className="text-gray-400 text-2xl">•</span>
                                )}
                              </td>
                              <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-900">
                                <div>
                                  <div className="font-medium">{formatDate(group.firstEvent.createdAt)}</div>
                                  {group.eventCount > 1 && <div className="text-xs text-gray-500">to {formatDate(group.lastEvent.createdAt)}</div>}
                                </div>
                              </td>
                              <td className="px-6 py-2 whitespace-nowrap">
                                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getActivityTypeColor(group.type)}`}>{group.type}</span>
                              </td>
                              <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-900">{group.courseTitle || 'N/A'}</td>
                              <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-900">{group.topicTitle || 'N/A'}</td>
                              <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-900">{group.eventCount > 1 ? <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">{group.eventCount} events</span> : <span className="text-gray-500">1 event</span>}</td>
                              <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-900">{formatDuration(group.totalDuration)}</td>
                            </tr>

                            {/* Expanded Individual Events */}
                            {group.eventCount > 1 &&
                              expandedGroups.has(group.id) &&
                              group.events.map((event, eventIndex) => (
                                <tr key={`${group.id}-event-${eventIndex}`} className="bg-gray-50">
                                  <td className="px-6 py-2 whitespace-nowrap">
                                    <span className="text-gray-400 ml-4"> </span>
                                  </td>
                                  <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-700 pl-8">{formatDate(event.createdAt)}</td>
                                  <td className="px-6 py-2 whitespace-nowrap">
                                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getActivityTypeColor(event.type)}`}>{event.type}</span>
                                  </td>
                                  <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-700">{event.courseTitle || 'N/A'}</td>
                                  <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-700">{event.topicTitle || 'N/A'}</td>
                                  <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-700">—</td>
                                  <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-700">{formatDuration(event.duration)}</td>
                                </tr>
                              ))}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
