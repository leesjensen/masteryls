import React, { useState, useEffect } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement);

export default function Metrics({ courseOps, setDisplayMetrics }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('7d');

  useEffect(() => {
    loadMetrics();
  }, [timeRange]);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      // For now, we'll use null for courseId, enrollmentId, and userId to get all data
      // In a real implementation, you might want to filter by current user/course
      const metricsData = await getMetrics(null, null, null, timeRange);
      setMetrics(metricsData);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading metrics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 m-4">
        <div className="text-red-800">
          <h3 className="font-semibold">Error loading metrics</h3>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">No metrics data available</div>
      </div>
    );
  }

  // Helper function to get time range description
  const getTimeRangeDescription = (timeRange) => {
    switch (timeRange) {
      case '1h':
        return 'Last Hour';
      case '3h':
        return 'Last 3 Hours';
      case '7d':
        return 'Last 7 Days';
      case '30d':
        return 'Last 30 Days';
      case '90d':
        return 'Last 90 Days';
      case '1y':
        return 'Last Year';
      default:
        return 'Last 30 Days';
    }
  };

  if (metrics.totalActivities === 0) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Learning Analytics Dashboard</h1>
              <button onClick={() => setDisplayMetrics(false)} className="ml-4 px-3 py-1 bg-gray-200 rounded-md text-sm hover:bg-gray-300">
                Close
              </button>
              <p className="text-sm text-gray-600 mt-1">Showing data for: {getTimeRangeDescription(timeRange)}</p>
            </div>
            <div className="flex space-x-2">
              <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-md bg-white text-sm">
                <option value="1h">Last hour</option>
                <option value="3h">Last 3 hours</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="1y">Last year</option>
              </select>
              <button onClick={loadMetrics} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm">
                Refresh
              </button>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-gray-400 text-6xl mb-4">📊</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Activity Data</h3>
          <p className="text-gray-600 mb-4">No learning activities found for the selected time range: {getTimeRangeDescription(timeRange)}</p>
          <p className="text-sm text-gray-500">Try selecting a different time range or check back later.</p>
        </div>
      </div>
    );
  }

  // Helper function to determine the number of data points to show based on time range
  const getDataPointsToShow = (timeRange) => {
    switch (timeRange) {
      case '1h':
      case '3h':
        return Object.keys(metrics.dailyActivity).length; // Show all for short ranges
      case '7d':
        return 7;
      case '30d':
        return 30;
      case '90d':
        return 90;
      case '1y':
        return 365;
      default:
        return 30;
    }
  };

  // Prepare data for charts
  const dataPointsToShow = getDataPointsToShow(timeRange);
  const sortedDates = Object.keys(metrics.dailyActivity).sort();
  const dailyLabels = sortedDates.slice(-dataPointsToShow);

  const dailyActivityData = {
    labels: dailyLabels,
    datasets: [
      {
        label: 'Daily Activities',
        data: dailyLabels.map((date) => metrics.dailyActivity[date]),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true,
      },
    ],
  };

  const activityTypesData = {
    labels: Object.keys(metrics.activityTypes),
    datasets: [
      {
        data: Object.values(metrics.activityTypes),
        backgroundColor: [
          '#3B82F6', // Blue
          '#10B981', // Green
          '#F59E0B', // Yellow
          '#EF4444', // Red
          '#8B5CF6', // Purple
          '#F97316', // Orange
        ],
        borderWidth: 2,
        borderColor: '#fff',
      },
    ],
  };

  const topActivitiesData = {
    labels: Object.keys(metrics.topActivities).slice(0, 10), // Top 10 activities
    datasets: [
      {
        label: 'Activity Count',
        data: Object.values(metrics.topActivities).slice(0, 10),
        backgroundColor: 'rgba(16, 185, 129, 0.8)',
        borderColor: 'rgb(16, 185, 129)',
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: `Activity Data (${timeRange})`,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
      },
      x: {
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          maxTicksLimit: timeRange === '1h' || timeRange === '3h' ? 24 : 10, // More ticks for short ranges
        },
      },
    },
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
      },
    },
  };

  async function getMetrics(courseId, enrollmentId, userId, timeRange = '30d') {
    const progressData = await courseOps.getProgress(courseId, enrollmentId, userId);

    // Calculate the cutoff date based on time range
    const now = new Date();
    let cutoffDate;

    switch (timeRange) {
      case '1h':
        cutoffDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '3h':
        cutoffDate = new Date(now.getTime() - 3 * 60 * 60 * 1000);
        break;
      case '1d':
        cutoffDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
        break;
      case '7d':
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        cutoffDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Filter progress data by time range
    const filteredProgressData = progressData.filter((activity) => {
      const activityDate = new Date(activity.createdAt);
      return activityDate >= cutoffDate;
    });

    // Process the filtered progress data to create metrics
    const metrics = {
      totalActivities: filteredProgressData.length,
      activityTypes: {},
      dailyActivity: {},
      weeklyActivity: {},
      averageDuration: 0,
      totalDuration: 0,
      topActivities: {},
      completionTrends: [],
    };

    let totalDurationSum = 0;
    let durationCount = 0;

    filteredProgressData.forEach((activity) => {
      // Activity types breakdown
      metrics.activityTypes[activity.type] = (metrics.activityTypes[activity.type] || 0) + 1;

      // Daily activity
      const date = new Date(activity.createdAt).toISOString().split('T')[0];
      metrics.dailyActivity[date] = (metrics.dailyActivity[date] || 0) + 1;

      // Weekly activity
      const week = getWeekNumber(new Date(activity.createdAt));
      metrics.weeklyActivity[week] = (metrics.weeklyActivity[week] || 0) + 1;

      // Duration calculations
      if (activity.duration > 0) {
        totalDurationSum += activity.duration;
        durationCount++;
      }
      metrics.totalDuration += activity.duration || 0;

      // Top activities by count
      metrics.topActivities[activity.activityId] = (metrics.topActivities[activity.activityId] || 0) + 1;
    });

    metrics.averageDuration = durationCount > 0 ? totalDurationSum / durationCount : 0;

    return metrics;
  }

  function getWeekNumber(date) {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Learning Analytics Dashboard</h1>
            <p className="text-sm text-gray-600 mt-1">
              Showing data for: {getTimeRangeDescription(timeRange)}
              {metrics && <span className="ml-2">({metrics.totalActivities} activities)</span>}
            </p>
          </div>
          <div className="flex space-x-2 mt-4 md:mt-0">
            <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-md bg-white text-sm">
              <option value="1h">Last hour</option>
              <option value="3h">Last 3 hours</option>
              <option value="1d">Last day</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="1y">Last year</option>
            </select>
            <button onClick={loadMetrics} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm">
              Refresh
            </button>
            <button onClick={() => setDisplayMetrics(false)} className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300 text-sm">
              Close
            </button>
          </div>
        </div>
      </div>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Activities</p>
              <p className="text-2xl font-semibold text-gray-900">{metrics.totalActivities.toLocaleString()}</p>
              <p className="text-xs text-gray-500">{getTimeRangeDescription(timeRange)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Time</p>
              <p className="text-2xl font-semibold text-gray-900">{Math.round(metrics.totalDuration / 60)} min</p>
              <p className="text-xs text-gray-500">{getTimeRangeDescription(timeRange)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Avg Session</p>
              <p className="text-2xl font-semibold text-gray-900">{Math.round(metrics.averageDuration / 60)} min</p>
              <p className="text-xs text-gray-500">{getTimeRangeDescription(timeRange)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Activity Types</p>
              <p className="text-2xl font-semibold text-gray-900">{Object.keys(metrics.activityTypes).length}</p>
              <p className="text-xs text-gray-500">{getTimeRangeDescription(timeRange)}</p>
            </div>
          </div>
        </div>
      </div>
      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Daily Activity Trend */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Activity Trend</h3>
          <div className="h-80">
            <Line data={dailyActivityData} options={chartOptions} />
          </div>
        </div>

        {/* Activity Types Distribution */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Types Distribution</h3>
          <div className="h-80">
            <Doughnut data={activityTypesData} options={doughnutOptions} />
          </div>
        </div>

        {/* Top Activities */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Learning Activities</h3>
          <div className="h-80">
            <Bar data={topActivitiesData} options={chartOptions} />
          </div>
        </div>

        {/* Learning Insights */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Learning Insights</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
              <span className="text-sm font-medium text-blue-900">Most Active Day</span>
              <span className="text-sm text-blue-700">{Object.keys(metrics.dailyActivity).reduce((a, b) => (metrics.dailyActivity[a] > metrics.dailyActivity[b] ? a : b)) || 'No data'}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
              <span className="text-sm font-medium text-green-900">Primary Activity Type</span>
              <span className="text-sm text-green-700">{Object.keys(metrics.activityTypes).reduce((a, b) => (metrics.activityTypes[a] > metrics.activityTypes[b] ? a : b)) || 'No data'}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
              <span className="text-sm font-medium text-yellow-900">Weekly Average</span>
              <span className="text-sm text-yellow-700">{Object.keys(metrics.weeklyActivity).length > 0 ? Math.round(Object.values(metrics.weeklyActivity).reduce((a, b) => a + b, 0) / Object.keys(metrics.weeklyActivity).length) : 0} activities</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
              <span className="text-sm font-medium text-purple-900">Learning Streak</span>
              <span className="text-sm text-purple-700">{Object.keys(metrics.dailyActivity).length} days active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
