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

  const fetchProgressData = async () => {
    if (!user || !courseOps) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get all progress records for the current user
      const allProgress = await courseOps.getProgress({
        userId: user.id,
        ...filter,
      });

      setProgressRecords(allProgress || []);
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
    fetchProgressData();
  };

  const clearFilters = () => {
    setFilter({
      type: '',
      courseId: '',
      startDate: '',
      endDate: '',
    });
    setTimeout(() => fetchProgressData(), 0);
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
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
            {loading && (
              <div className="text-center py-8">
                <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                <p className="mt-2 text-gray-600">Loading progress data...</p>
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
            {!loading && !error && (
              <>
                <div className="mb-4 text-sm text-gray-600">
                  Showing {sortedRecords.length} progress record{sortedRecords.length !== 1 ? 's' : ''}
                </div>

                {sortedRecords.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No progress records found. Start learning to see your progress here!</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('createdAt')}>
                            Date & Time
                            {sortConfig.key === 'createdAt' && <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('type')}>
                            Activity Type
                            {sortConfig.key === 'type' && <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Topic</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('duration')}>
                            Duration
                            {sortConfig.key === 'duration' && <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {sortedRecords.map((record, index) => (
                          <tr key={record.id || index} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(record.createdAt)}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getActivityTypeColor(record.type)}`}>{record.type}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.catalogId || 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.topicId || 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDuration(record.duration)}</td>
                            <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{record.details && Object.keys(record.details).length > 0 ? JSON.stringify(record.details) : '-'}</td>
                          </tr>
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
