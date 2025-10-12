import React, { useState, useEffect } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement);

export default function Metrics({ courseOps }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('1h');

  useEffect(() => {
    loadMetrics();
  }, [timeRange]);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      // For now, we'll use null for courseId, enrollmentId, and userId to get all data
      // In a real implementation, you might want to filter by current user/course
      const metricsData = await courseOps.getMetrics(null, null, null);
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

  // Prepare data for charts
  const dailyActivityData = {
    labels: Object.keys(metrics.dailyActivity).sort().slice(-30), // Last 30 days
    datasets: [
      {
        label: 'Daily Activities',
        data: Object.keys(metrics.dailyActivity)
          .sort()
          .slice(-30)
          .map((date) => metrics.dailyActivity[date]),
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

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Learning Analytics Dashboard</h1>
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
